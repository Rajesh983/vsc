const getGitAPI = require("./getGitAPI");

async function getRepoInfo() {
  let gitAPI = await getGitAPI();
  let ownerUsername;
  let repoName;

  let config = await gitAPI?.repositories[0]?.getConfig(
    "remote.origin.url"
  );
  if (config?.includes("https://")) {
    if (config?.includes("github.com")) {
      repoName = config?.split("/")[4].split(".")[0];
      ownerUsername = config?.split("/")[3];
      return { ownerUsername, repoName };
    } else {
        return vscode.window.showErrorMessage(
            "We're sorry, we only work with GitHub for now."
          )
    }
  } else {
    repoName = config?.split("/")[1].split(".")[0] ?? "";
    ownerUsername = config?.split(":")[1].split("/")[0] ?? "";
  }
  return { ownerUsername, repoName };
}


module.exports = getRepoInfo