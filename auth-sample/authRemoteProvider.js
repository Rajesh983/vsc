const { authentication, Disposable, env, EventEmitter, ProgressLocation, Uri, window } = require("vscode");
const { v4 } = require('uuid');
const { promiseFromEvent } = require("./util");
const { generateSecret } = require("./generate_secret.js");
const fetch = require("node-fetch")

const crypto = require('crypto');

const AUTH_TYPE = `auth0`;
const AUTH_NAME = `Auth0`;
const CLIENT_ID = `673dd63d0a24b20d89412ec829b7baa3fffbf9ead0bb5525349a8172c07ea9b3`; //`3GUryQ7ldAeKEuD2obYnppsnmj58eP5u`;
const AUTH0_DOMAIN = 'gitlab.com';   //`dev-txghew0y.us.auth0.com`
const SESSIONS_SECRET_KEY = `${AUTH_TYPE}.sessions`
const REDIRECT_URL = `${env.uriScheme}://alpine.8800/`;//`${env.uriScheme}://gitlab.gitlab-workflow/authentication`

let remoteOutput = window.createOutputChannel("auth0");


const generateCodeChallengeFromVerifier = (v) => {
    const sha256 = (plain) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(plain);
      return crypto.createHash('sha256').update(data);
    };
    return sha256(v).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };


class UriEventHandler extends EventEmitter {
    handleUri(uri) {
        this.fire(uri);
    }
}

class Auth0AuthenticationProvider {
    _sessionChangeEmitter = new EventEmitter();
    _disposable;
    _pendingStates = [];
    _codeExchangePromises = new Map();
    _codeVerfifiers = new Map();
    _scopes = new Map();
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

        let callbackUrl = `${env.uriScheme}://${publisher}.${name}/`;

        console.log({callbackUrl})
        return callbackUrl;
    }

    /**
     * Get the existing sessions
     * @param scopes 
     * @returns 
     */
    async getSessions(scopes) {
        try {
            const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);
            console.log({allSessions})
            if (!allSessions) {
                return [];
            }

            // Get all required scopes
            const allScopes = this.getScopes(scopes || []);

            const sessions = JSON.parse(allSessions);
            if (sessions) {
                if (allScopes && scopes) {
                    const session = sessions.find(s => scopes.every(scope => s.scopes.includes(scope)));
                    if (session && session.refreshToken) {
                        console.log(session.refreshToken,"refreshhhh")
                        const refreshToken = session.refreshToken;
                        const { access_token } = await this.getAccessToken(refreshToken, CLIENT_ID);

                        console.log({access_token})

                        if (access_token) {
                            const updatedSession = Object.assign({}, session, { accessToken: access_token, scopes: scopes });
                            return [updatedSession];
                        } else {
                            this.removeSession(session.id);
                        }
                    }
                } else {
                    return sessions;
                }
            }
        } catch (e) {
            // Nothing to do
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
            const { access_token, refresh_token } = await this.login(scopes);

            console.log({access_token,refresh_token})
            if (!access_token) {
                throw new Error(`Auth0 login failure`);
            }

            const userinfo = await this.getUserInfo(access_token);

            console.log("hagsdagsdkagds",userinfo[0])

            const session = {
                id: v4(),
                accessToken: access_token,
                refreshToken: refresh_token,
                account: {
                    label: userinfo.name,
                    id: userinfo.email
                },
                scopes: this.getScopes(scopes)
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
    async removeSession(sessionId) {
        const allSessions = await this.context.secrets.get(SESSIONS_SECRET_KEY);
        if (allSessions) {
            let sessions = JSON.parse(allSessions);
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
        const account =  await window.withProgress({
            location: ProgressLocation.Notification,
            title: "Signing in to Auth0...",
            cancellable: true
        }, async (_, token) => {
            console.log(token,"login section")
            const nonceId = v4();

            const scopeString = scopes.join(' ');

            // Retrieve all required scopes
            scopes = this.getScopes(scopes);

            const codeVerifier = generateSecret()//toBase64UrlEncoding(crypto.randomBytes(32))
            const codeChallenge = generateCodeChallengeFromVerifier(codeVerifier)//toBase64UrlEncoding(sha256(codeVerifier));


            let callbackUri = await env.asExternalUri(Uri.parse(this.redirectUri));

            console.log({codeVerifier,codeChallenge,callbackUri})

            remoteOutput.appendLine(`Callback URI: ${callbackUri.toString(true)}`);

            const callbackQuery = new URLSearchParams(callbackUri.query);
            const stateId = callbackQuery.get('state') || nonceId;

            console.log({callbackQuery,stateId})

            remoteOutput.appendLine(`State ID: ${stateId}`);
            remoteOutput.appendLine(`Nonce ID: ${nonceId}`);

            callbackQuery.set('state', encodeURIComponent(stateId));
            callbackQuery.set('nonce', encodeURIComponent(nonceId));
            callbackUri = callbackUri.with({
                query: callbackQuery.toString()
            });

            this._pendingStates.push(stateId);
            this._codeVerfifiers.set(stateId, codeVerifier);

            console.log(this._codeVerfifiers.get(stateId),"verifier")

            this._scopes.set(stateId, scopes);

            const searchParams = new URLSearchParams([
                ['client_id', CLIENT_ID],
                ['client_secret','efdeef68d4019872b8a06f682f1e341b2e900da2dc6192d3f52edbfd061df12c'],
                ['redirect_uri', REDIRECT_URL],
                ['response_type', "code"],
                ['state',stateId],
                //['state', encodeURIComponent(callbackUri.toString(true))],
                ['scopes', scopes.join(' ')],
                // ['prompt', "login"],
                ['code_challenge', codeChallenge],
                ['code_challenge_method', 'S256']
                
            ]);
            const uri = Uri.parse(`https://${AUTH0_DOMAIN}/oauth/authorize?${searchParams.toString()}`);

            remoteOutput.appendLine(`Login URI: ${uri.toString(true)}`);

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
                this._codeVerfifiers.delete(stateId);
                this._scopes.delete(stateId);
            }
        });

        console.log({account})
        return account
    }

    /**
     * Handle the redirect to VS Code (after sign in from Auth0)
     * @param scopes 
     * @returns 
     */
    handleUri = (scopes) => async (uri, resolve, reject) => {

        console.log({scopes,uri,resolve,reject})


        const query = new URLSearchParams(uri.query);
        const code = query.get('code');
        const stateId = query.get('state');

        console.log({query,code,stateId})

        if (!code) {
            reject(new Error('No code'));
            return;
        }
        if (!stateId) {
            reject(new Error('No state'));
            return;
        }


        const codeVerifier = this._codeVerfifiers.get(stateId);

        console.log({codeVerifier})
        
        if (!codeVerifier) {
            reject(new Error('No code verifier'));
            return;
        }

        // Check if it is a valid auth request started by the extension
        if (!this._pendingStates.some(n => n === stateId)) {
            reject(new Error('State not found'));
            return;
        }

        const postData = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            code,
            code_verifier: codeVerifier,
            redirect_uri: REDIRECT_URL,
        }).toString();

        const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                'Content-Length': postData.length.toString()
            },
            body: postData
        });

        const { access_token, refresh_token } = await response.json();

        console.log({response,access_token,refresh_token})

        resolve({
            access_token,
            refresh_token
        });
    }

    /**
     * Get the user info from Auth0
     * @param token 
     * @returns 
     */
    async getUserInfo(token) {
        console.log(token,'user token')
        const response = await fetch(`https://${AUTH0_DOMAIN}/api/v4/user`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json, text/plain, */*'
            }
        })
        

        console.log({response},"user info");
        let res = await response.json();
        console.log("res",res)
        return `${res}`;
    }

    /**
     * Get all required scopes
     * @param scopes 
     */
    getScopes(scopes = []) {
        let modifiedScopes = [...scopes];

        // if (!modifiedScopes.includes('offline_access')) {
        //     modifiedScopes.push('offline_access');
        // }
        // if (!modifiedScopes.includes('openid')) {
        //     modifiedScopes.push('openid');
        // }
        // if (!modifiedScopes.includes('profile')) {
        //     modifiedScopes.push('profile');
        // }
        // if (!modifiedScopes.includes('email')) {
        //     modifiedScopes.push('email');
        // }

        return modifiedScopes.sort();
    }

    /**
     * Retrieve a new access token by the refresh token
     * @param refreshToken 
     * @param clientId 
     * @returns 
     */
    async getAccessToken(refreshToken, clientId) {
        const postData = new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            refresh_token: refreshToken
        }).toString();

        const response = fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                'Content-Length': postData.length.toString()
            },
            body: postData
        });

        console.log({response})
        const { access_token } = await response.json();

        return { access_token, refresh_token: "" };
    }
}

function toBase64UrlEncoding(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function sha256(buffer) {
    return crypto.createHash('sha256').update(buffer).digest();
}

module.exports = { AUTH_TYPE, toBase64UrlEncoding, sha256, Auth0AuthenticationProvider }