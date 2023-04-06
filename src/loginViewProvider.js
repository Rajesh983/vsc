const vscode = require("vscode");

const getRepoInfo = require('../vscode-git/getRepoInfo')

class loginViewProvider {

  constructor(
    context
  ) {
    this._extensionUri = context.extensionUri;
    this._context = context;
  }

  resolveWebviewView(webviewView, context, _token) {
    this._view = webviewView;
    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
      enableCommandUris: true,
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview,'initial');


    webviewView.webview.onDidReceiveMessage(async (data) => {
      console.log({data})
      if(data.type === 'logged_in'){
        //vscode.env.openExternal('https://github.com/login');
        const repoInfo = await getRepoInfo()
        console.log({repoInfo})
        this.sendMessage({type:'logged_in',repo:repoInfo})
      }else{
        this.sendMessage({type:'not_logged_in'})
      }
    })

  }


  async sendMessage(message) {
    if (this._view) {
      this._view.show(true); // `show` is not implemented in 1.49 but is for 1.50 insiders
      await this._view.webview.postMessage(message);
    }
  }



  




  _getHtmlForWebview(
    webview,type
  ) {

    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "style.css")
    );

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'))

    const nonce = getNonce();
    

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="X-UA-Compatible" content="IE=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link href="${styleVSCodeUri}" rel="stylesheet">
          <title>Document</title>
        </head>
        <body>
          <script nonce="${nonce}" type="text/javascript" src="${scriptUri}"> </script>
        </body>
      </html>`;
  }
}


module.exports = loginViewProvider


/**
 * Manages watermelon webview panel
 * 
 * 
 * 
 * 
 * 
 * "Sample-Product": [
        {
          "id": "exampleTreeview",
          "name": ""
        }
      ],
      "explorer": [
        {
          "type": "webview",
          "id": "calicoColors.colorsView",
          "name": "Calico Colors"
        }
      ]
 */


function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}


