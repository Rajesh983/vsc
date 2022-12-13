 async function getGitHubUserInfo({
    octokit,
  }) {
    let octoresp = await octokit.request('GET /user');
    return octoresp?.data;
  }

  module.exports = getGitHubUserInfo