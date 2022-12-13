const vscode =  require("vscode");
const Octokit = require("@octokit/rest");

const GITHUB_AUTH_PROVIDER_ID = 'github'
const SCOPES = ["user:email", "repo", "read:org"]

class Credentials {
   octokit

  async initialize(context){
    this.registerListeners(context);
    this.setOctokit();
  }

   async setOctokit() {
    /**
     * By passing the `createIfNone` flag, a numbered badge will show up on the accounts activity bar icon.
     * An entry for the sample extension will be added under the menu to sign in. This allows quietly
     * prompting the user to sign in.
     * */
    
    const session =  await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER_ID,
      SCOPES,
      // {forceNewSession:true}
     { createIfNone: true }
    );
    

    if (session) {
      this.octokit = new Octokit.Octokit({
        auth: session.accessToken,
      });

      return;
    } else {
      vscode.window
        .showInformationMessage("No GitHub session found. Please sign in.")
        .then(async (value) => {
          if (value === "Sign in") {
            await vscode.commands.executeCommand(
              "workbench.action.accounts.login"
            );
          }
        });
    }

    this.octokit = undefined;
  }

  registerListeners(context) {
    /**
     * Sessions are changed when a user logs in or logs out.
     */
    context.subscriptions.push(
      vscode.authentication.onDidChangeSessions(async (e) => {
        if (e.provider.id === GITHUB_AUTH_PROVIDER_ID) {
          await this.setOctokit();
        }
      })
    );
  }

  async getOctokit() {
    if (this.octokit) {
      return this.octokit;
    }

    /**
     * When the `createIfNone` flag is passed, a modal dialog will be shown asking the user to sign in.
     * Note that this can throw if the user clicks cancel.
     */
    const session = await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER_ID,
      SCOPES,
       { createIfNone: true }
    );
    if (session) {
      this.octokit = new Octokit.Octokit({
        auth: session.accessToken,
      });
      return this.octokit;
    } else {
      vscode.window
        .showInformationMessage("No GitHub session found. Please sign in.")
        .then(async (value) => {
          if (value === "Sign in") {
            await vscode.commands.executeCommand(
              "workbench.action.accounts.login"
            );
          }
        });
    }
  }
}


module.exports = Credentials