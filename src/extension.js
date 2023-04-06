const vscode = require('vscode')

const Credentials = require('./credentials')
const getGitHubUserInfo = require("../vscode-git/getGitHubUserInfo");

async function activate(context) {
    //Authentication experiments
    let CLIENT_ID = "3b551ce8d3a428986370"
    let CLIENT_SECRET = "ad4ecf104f6c3990b0bcc3edc7316f6417000f7a"
    const uri = vscode.Uri.parse(`https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&&client_secret=${CLIENT_SECRET}&scope=repo,read:org,read:user,user:email`);
    await vscode.env.openExternal(uri);

}

async function deactivate() {
    vscode.window.showInformationMessage("deactivated...")
}

module.exports = {
    activate,
    deactivate,
};
