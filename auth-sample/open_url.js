 const openUrl = async (url) => {
    // workaround for a VS Code open command bug: https://gitlab.com/gitlab-org/gitlab-vscode-extension/-/issues/44
    const urlArgument = ifVersionGte(
      vscode.version,
      '1.65.0',
      () => url,
      () => vscode.Uri.parse(url),
    );
    await vscode.commands.executeCommand('vscode.open', urlArgument);
  };