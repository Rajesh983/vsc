const vscode = require('vscode')

async function getGitAPI() {
    try {
      const extension = vscode?.extensions?.getExtension(
        "vscode.git"
      )
      if (extension !== undefined) {
        const gitExtension = extension.isActive
          ? extension.exports
          : await extension.activate();
  
        return gitExtension.getAPI(1);
      }
    } catch {}
  
    return undefined;
  }


  module.exports = getGitAPI