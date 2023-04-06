const { authentication,Disposable, env, EventEmitter, ProgressLocation, Uri, window } = require("vscode");
const { v4 } = require('uuid');
const {  promiseFromEvent } = require("./util.js");
const axios = require('axios');
const { generateSecret } = require("./generate_secret.js");

const AUTH_TYPE = `auth0`;
const AUTH_NAME = `Auth0`;
const CLIENT_ID = `36f2a70cddeb5a0889d4fd8295c241b7e9848e89cf9e599d0eed2d8e5350fbf5`;
const AUTH0_DOMAIN = `gitlab.com`;   //dev-txghew0y.us.auth0.com
const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`



const generateCodeChallengeFromVerifier = (v) => {
    const sha256 = (plain) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(plain);
      return crypto.createHash('sha256').update(data);
    };
    return sha256(v).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };


const createAuthUrl = ({
    clientId,
    redirectUri,
    responseType = 'code',
    state,
    scopes,
    codeChallenge,
    codeChallengeMethod = 'S256',
  }) =>
    `https://gitlab.com/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: responseType,
      state,
      scope: scopes,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
    })}`;

    const createLoginUrl = (
        scopesParam,
      ) => {
        const state = generateSecret();
        const redirectUri = `${env.uriScheme}://gitlab.gitlab-workflow/authentication`;
        const codeVerifier = generateSecret();
        const codeChallenge = generateCodeChallengeFromVerifier(codeVerifier);
        const scopes = (scopesParam ?? ['api', 'read_user']).join(' ');
        const clientId = '36f2a70cddeb5a0889d4fd8295c241b7e9848e89cf9e599d0eed2d8e5350fbf5';
        return {
          url: createAuthUrl({ clientId, redirectUri, state, scopes, codeChallenge }),
          state,
          codeVerifier,
        };
      };





class UriEventHandler extends EventEmitter {
	 handleUri(uri) {
		this.fire(uri);
	}
}

 class Auth0AuthenticationProvider  {
   _sessionChangeEmitter = new EventEmitter();
   _disposable;
   _pendingStates = [];
   _codeExchangePromises = new Map();
   _uriHandler = new UriEventHandler();
  
  constructor(context) {
    this._disposable = Disposable.from(
      authentication.registerAuthenticationProvider(AUTH_TYPE, AUTH_NAME, this, { supportsMultipleAccounts: false }),
      window.registerUriHandler(this._uriHandler)
    )
    this.context = context
  }

	get onDidChangeSessions() {
		return this._sessionChangeEmitter.event;
	}

  get redirectUri() {
    const publisher = this.context.extension.packageJSON.publisher;
    const name = this.context.extension.packageJSON.name;
    console.log(env.uriScheme,"uri Scheme")
    //return `${env.uriScheme}://gitlab.gitlab-workflow/authentication`
    return `${env.uriScheme}://${publisher}.${name}`;
  }

  /**
   * Get the existing sessions
   * @param scopes 
   * @returns 
   */
   async getSessions(scopes) {
    const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);

    if (allSessions) {
      return JSON.parse(allSessions);
    }

    return [];
  }

  /**
   * Create a new auth session
   * @param scopes 
   * @returns 
   */
   async createSession(scopes) {
    try {
      const token = await this.login(scopes);
      if (!token) {
        throw new Error(`Auth0 login failure`);
      }

      const userinfo = await this.getUserInfo(token);

      const session = {
        id: v4(),
        accessToken: token,
        account: {
          label: userinfo.name,
          id: userinfo.email
        },
        scopes: []
      };

      await this.context.secrets.store(SESSIONS_SECRET_KEY, JSON.stringify([session]))

      this._sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });

      return session;
    } catch (e) {
      window.showErrorMessage(`Sign in failed: ${e}`);
			throw e;
    }
  }

  /**
   * Remove an existing session
   * @param sessionId 
   */
   async removeSession(sessionId){
    const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);
    if (allSessions) {
      let sessions = JSON.parse(allSessions) ;
      const sessionIdx = sessions.findIndex(s => s.id === sessionId);
      const session = sessions[sessionIdx];
      sessions.splice(sessionIdx, 1);

      await this.context.secrets.store(SESSIONS_SECRET_KEY, JSON.stringify(sessions));

      if (session) {
        this._sessionChangeEmitter.fire({ added: [], removed: [session], changed: [] });
      }      
    }
  }

  /**
   * Dispose the registered services
   */
	 async dispose() {
		this._disposable.dispose();
	}

  /**
   * Log in to Auth0
   */
   async login(scopes = []) {
    return await window.withProgress({
			location: ProgressLocation.Notification,
			title: "Signing in to Auth0...",
			cancellable: true
		}, async (_, token) => {
      const stateId = v4();

      this._pendingStates.push(stateId);

      const scopeString = scopes.join(' ');

      if (!scopes.includes('openid')) {
        scopes.push('openid');
      }
      if (!scopes.includes('profile')) {
        scopes.push('profile');
      }
      if (!scopes.includes('email')) {
        scopes.push('email');
      }

      const searchParams = new URLSearchParams([
        ['client_id', CLIENT_ID],
        ['redirect_uri', this.redirectUri],
        ['response_type', "code"],
        ['state', stateId],
        ['scope', scopes.join(' ')]
        //['prompt', "login"]
      ]);
      const uri = Uri.parse(`https://${AUTH0_DOMAIN}/oauth/authorize?${searchParams.toString()}`);
      await env.openExternal(uri);

      let codeExchangePromise = this._codeExchangePromises.get(scopeString);
      if (!codeExchangePromise) {
        codeExchangePromise = promiseFromEvent(this._uriHandler.event, this.handleUri(scopes));
        this._codeExchangePromises.set(scopeString, codeExchangePromise);
      }

      try {
        return await Promise.race([
          codeExchangePromise.promise,
          new Promise((_, reject) => setTimeout(() => reject('Cancelled'), 60000)),
          promiseFromEvent(token.onCancellationRequested, (_, __, reject) => { reject('User Cancelled'); }).promise
        ]);
      } finally {
        this._pendingStates = this._pendingStates.filter(n => n !== stateId);
        codeExchangePromise?.cancel.fire();
        this._codeExchangePromises.delete(scopeString);
      }
    });
  }

  /**
   * Handle the redirect to VS Code (after sign in from Auth0)
   * @param scopes 
   * @returns 
   */
   handleUri = (scopes) => async (uri, resolve, reject) => {
    const query = new URLSearchParams(uri.fragment);
    const access_token = query.get('access_token');
    const state = query.get('state');

    console.log({query,access_token,state})

    if (!access_token) {
      reject(new Error('No token'));
      return;
    }
    if (!state) {
      reject(new Error('No state'));
      return;
    }

    // Check if it is a valid auth request started by the extension
    if (!this._pendingStates.some(n => n === state)) {
      reject(new Error('State not found'));
      return;
    }

    resolve(access_token);
  }

  /**
   * Get the user info from Auth0
   * @param token 
   * @returns 
   */
   async getUserInfo(token) {
    const response = await axios(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return await response.json();
  }
}


module.exports={AUTH_TYPE,Auth0AuthenticationProvider}