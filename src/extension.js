const vscode = require("vscode");
const axios = require("axios");

const path = require("path");
const fs = require("fs");
const { posix } = require("path");




let myData, view;
let stageData, stageView, stageFilesList;
let octokit;

const DataProvider = require("./experiments.js");
const loginViewProvider = require("./loginViewProvider")
const Credentials = require("./credentials")
const getGitHubUserInfo = require("../vscode-git/getGitHubUserInfo")

/**
 * @param {vscode.ExtensionContext} context
 *
 *
 * fhx7pcw4ro5zdwav4csygacyjcfcqld56o6wwikdznforskrzpdq
 * *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
 */

let total = 0;
let count = 0;
let files = [];
let gitEnabled = false;
let filesList;

async function countAndTotalOfFilesInFolder(folder) {
  //console.log({folder})
  for (const [name, type] of await vscode.workspace.fs.readDirectory(folder)) {
    //console.log({name,type})
    if (type === vscode.FileType.File && name[0] !== ".") {
      const filePath = posix.join(folder.path, name);
      files.push({ filePath, name });
      const stat = await vscode.workspace.fs.stat(
        folder.with({ path: filePath })
      );
      total += stat.size;
      count += 1;
    } else if (type === vscode.FileType.Directory) {
      if (name[0] !== ".") {
        const filePath = posix.join(folder.path, name);
        const folderUri = vscode.Uri.file(filePath);
        const folderPath = posix.dirname(folderUri.path);
        const subFolder = folderUri.with({ path: filePath });
        //console.log({filePath,folderPath,folderUri})
        await countAndTotalOfFilesInFolder(subFolder);
        //console.log({allFiles})
      }
      if (name === ".git") {
        gitEnabled = true;
      }
    }
  }
  return { total, count, files, gitEnabled };
}

async function activate(context) {



  // context.subscriptions.push(
  //   vscode.window.createTerminal({ name: 'Hooks', hideFromUser: true }).sendText('git config core.hooksPath ./pre-commit'),
  // )

  context.subscriptions.push(
    vscode.window
      .showInformationMessage("Do you want to do this?", "Yes", "No")
      .then(async (answer) => {
        if (answer === "Yes") {
          const wsedit = new vscode.WorkspaceEdit();
          const wsPath = vscode.workspace.workspaceFolders[0].uri.fsPath; // gets the path of the first workspace folder
          const filePath = vscode.Uri.file(wsPath + '/.EMP/pre-commit');
          const newTerminal = vscode.window.createTerminal({ name: 'Hooks', hideFromUser: true })
          newTerminal.sendText('git config core.hooksPath .EMP')
          newTerminal.sendText('chmod +x .EMP/pre-commit')
          var uint8array = new TextEncoder().encode('echo "$(dirname -- "$0")\necho "Helloo World"');
          wsedit.createFile(filePath, { ignoreIfExists: true,contents:uint8array});
          await vscode.workspace.applyEdit(wsedit);
        } else {
          console.log("No")
        }
      })
  )



  const findPre = await vscode.workspace.findFiles('**/pre-commit',"**/node_modules/**")
  console.log({findPre})


  // const uri = vscode.Uri.file(findPre[0].path)

  // vscode.workspace.openTextDocument(uri).then((document) => {
  //   let text = document.getText();
  //   console.log({text})
  // });



  //adding webview view 

  const provider = new loginViewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('login.sidebar', provider)
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('login.sendMessage', () => {
        provider.sendMessage();
      }));
  
    

      const credentials = new Credentials();
      const sampleRes = await credentials.initialize(context);
      octokit = await credentials.getOctokit();
      let githubUserInfo = await getGitHubUserInfo({ octokit });
      let username = githubUserInfo.login;
      console.log({sampleRes,octokit,githubUserInfo})

  //done adding webview view


  // Adding files to our extension dynamically

  // context.subscriptions.push(
  //   vscode.workspace.onDidCreateFiles(async (e) => {
  //     console.log({ created: e });

  //     const gitExtension = vscode.extensions.getExtension("vscode.git").exports;
  //     const api = gitExtension.getAPI(1);

  //     const repo = api.repositories[0];

  //     const changes = await repo.diffWithHEAD();

  //     console.log({ changes });

  //     if (changes.length === 0) {
  //       const latestFiles = await countAndTotalOfFilesInFolder(
  //         vscode.workspace.workspaceFolders[0].uri
  //       );
  //       filesList = latestFiles.files;
  //     } else {
  //       const updatedFilesList = changes.map((eachChange) => {
  //         const filePath = eachChange.uri.path;
  //         const name = filePath.split("/").slice(-1)[0];
  //         return { filePath, name };
  //       });
  //       filesList = updatedFilesList;
  //     }

  //     myData.gettingUpdatedFilesList(filesList);
  //     myData.refresh();

  //     view.badge = { value: filesList.length };
  //   })
  // );

  //making API call

  const res = await axios.get("https://jsonplaceholder.typicode.com/photos");

  const updatedData = res.data.map((eachPhoto) => {
    return {
      label: eachPhoto.title.slice(0, 7),
      detail: eachPhoto.title,
      link: eachPhoto.thumbnailUrl,
    };
  });

  // registering commands

  let disposable = vscode.commands.registerCommand(
    "alpine.search",
    async function () {
      const todo = await vscode.window.showQuickPick(updatedData, {
        matchOnDetail: true,
      });

      if (todo == null) return;

      vscode.env.openExternal(todo.link);
    }
  );

  let openFileCmd = vscode.commands.registerCommand(
    "open.file",
    async function (args) {
      //vscode.window.showInformationMessage(args);
      try {
        //let uri = vscode.Uri.file(args);
        //console.log({uri})
        //await vscode.commands.executeCommand("vscode.openFolder", uri);

        const leftUri = args.leftUri
        const rightUri = args.rightUri
        console.log({ leftUri, rightUri })

        await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, "Comparision");

      } catch (error) {
        console.log(error);
      }
    }
  );

  // accessing git extension from our extension

  vscode.extensions.onDidChange(function (event) {
    console.log("Event happened: " + event);
  });

  const gitExtension = vscode.extensions.getExtension("vscode.git").exports;
  const api = gitExtension.getAPI(1);

  // const repo = api.repositories[0];

  // const changes = await repo.diffWithHEAD();

  let changes = [];
  //console.log(api.state)

  /* If git is not initialized, api.repositories gives empty array */

  console.log({ gitExtension, api });

  // changing files dynamically with git

  // if (changes.length === 0) {
  //   const latestFiles = await countAndTotalOfFilesInFolder(
  //     vscode.workspace.workspaceFolders[0].uri
  //   );
  //   filesList = latestFiles.files;
  // } else {
  // try {
  //   const res123 = await api.repositories[0].getObjectDetails();

  //   console.log("repositories", res123);

  // } catch (error) {
  //   console.log(error)
  // }

  // experiments block starts

  //editing file tracking and line numbers starts


  vscode.workspace.onDidSaveTextDocument((document) => {
    const file = document.fileName;
    vscode.window.showInformationMessage(`Saved ${file}`);
  });

  vscode.workspace.onDidOpenTextDocument((document) => {
    const file = document.fileName;
    vscode.window.showInformationMessage(`Opened ${file}`);
  });

  vscode.workspace.onDidChangeTextDocument((changes) => {
    const file = changes.document.fileName;
    console.log(changes.contentChanges[0].text, "text")
    let startLine = changes.contentChanges[0].range._start._line + 1

    console.log(changes.contentChanges[0].range._end, "end")

    vscode.window.showInformationMessage(`You are editing at line ${startLine}`);
  });




  api.repositories[0].repository.workingTreeGroup.onDidUpdateResourceStates(e => {
    console.log("onDidUpdateResourceStates", e)
  })

  //editing file tracking and line numbers ends




  console.log(api.repositories[0].state.workingTreeChanges, "Changes Files")
  console.log(api.repositories[0].state.indexChanges, "Staged Files")
  console.log(api.repositories[0].state.mergeChanges, "Merge Files")

  //Getting local git user details

  const localUsername = await api.repositories[0].getGlobalConfig('user.name')
  const localEmail = await api.repositories[0].getGlobalConfig('user.email')
  console.log({username:localUsername,email:localEmail})

  try{
    let config = await api.repositories[0].getConfig('remote.origin.url')
    console.log({config})
  }catch(e){
    console.log({e})
  }


  api.repositories[0].repository.onDidChangeOriginalResource(async (e) => {
    console.log("onDidChangeOriginalResource", e)
  })

  api.repositories[0].repository.onDidRunOperation(async (e) => {
    console.log("onDidRunOperation", e)
  })

  api.repositories[0].repository.onRunOperation(async (e) => {
    console.log("onRunOperation", e)
  })


  api.repositories[0].repository.onDidChangeRepository(async (e) => {
    console.log("onDidChangeRepository", e)
  })


  api.repositories[0].repository.onDidRunGitStatus(async (e) => {
    const branchDetails = await api.repositories[0].repository.HEAD

    //getting remote repositories information
    const remotes = await api.repositories[0].repository.remotes

    console.log({ branchDetails, remotes })
    vscode.window.showInformationMessage(`You are on ${branchDetails.name} branch`)
    if (api.repositories[0].state.indexChanges.length !== 0) {
      const resourceList = api.repositories[0].state.indexChanges;




      const urisList = resourceList.map(
        (eachRes) => eachRes.uri
      );

      changes = urisList;
      const updatedFilesList = changes.map((eachChange) => {
        //const filePath = eachChange.uri.path;
        const filePath = eachChange.path;
        const name = filePath.split("/").slice(-1)[0];
        const fileResource = eachChange
        return { filePath, name, fileResource };
      });
      stageFilesList = updatedFilesList;

      myData.gettingUpdatedFilesList(filesList, stageFilesList);
      myData.refresh();
      view.badge = { value: filesList.length + stageFilesList.length };
    } else {
      stageFilesList = [];
      myData.gettingUpdatedFilesList(filesList, stageFilesList);
      myData.refresh();
      view.badge = { value: filesList.length + stageFilesList.length };
    }
  })

  // experiments block ends

  api.onDidOpenRepository((e) => {
    //console.log("open", e);
    openGitFiles()
  });



  api.onDidCloseRepository(async (e) => {
    //console.log("close", e);
    filesList = [];
    myData.gettingUpdatedFilesList(filesList, filesList);
    myData.refresh();
    view.badge = { value: 0 };
    vscode.window.showInformationMessage("Please initialize git")

  });


  api.onDidPublish((e) => {
    // console.log("Published", e);
    //   filesList = [];
    //   myData.gettingUpdatedFilesList(filesList,"Files");
    //   myData.refresh();
    //    view.badge = { value: 0 };
  })

  async function openGitFiles() {
    if (api.repositories.length === 0) {
      vscode.window.showInformationMessage("Please initialize git");

    } else {
      //console.log("files count", api.repositories[0].ui._sourceControl.count);
      //console.log(api.repositories[0].state.HEAD,"Head")
      const resourceList = api.repositories[0].state.workingTreeChanges;
      const stageList = api.repositories[0].state.indexChanges;

      const remotes = await api.repositories[0].repository


      const urisList = resourceList.map(
        (eachRes) => eachRes.uri

      );

      const stageUrisList = stageList.map(
        (eachRes) => eachRes.uri
      );

      changes = urisList;
      const updatedFilesList = changes.map((eachChange) => {
        //const filePath = eachChange.uri.path;
        console.log({ eachChange })
        const filePath = eachChange.path;
        const name = filePath.split("/").slice(-1)[0];
        const fileResource = eachChange
        return { filePath, name, fileResource };
      });
      filesList = updatedFilesList;

      stageFilesList = stageUrisList.map((eachChange) => {
        const filePath = eachChange.path;
        const name = filePath.split("/").slice(-1)[0];
        const fileResource = eachChange
        return { filePath, name, fileResource };
      });

      // }

      // creating treeView(to show files in our plugin)

      myData = new DataProvider(filesList, stageFilesList);


      // view = vscode.window.createTreeView("exampleTreeview", {
      //   treeDataProvider: myData,
      // });

      // view.badge = { value: filesList.length + stageFilesList.length };
      // //    view.message = "This is message"
      // //view.onDidChangeSelection( e => click(e.selection));
      // context.subscriptions.push(view);


      api.repositories[0].state.onDidChange(() => {

        const resourceList = api.repositories[0].state.workingTreeChanges;
        const urisList = resourceList.map(
          (eachRes) => eachRes.uri
        );
        const updatedFilesList = urisList.map((eachChange) => {
          const filePath = eachChange.path;
          const name = filePath.split("/").slice(-1)[0];
          const fileResource = eachChange
          return { filePath, name, fileResource };
        });
        filesList = updatedFilesList;
        myData.gettingUpdatedFilesList(filesList, stageFilesList);
        myData.refresh();

        view.badge = { value: filesList.length + stageFilesList.length };
      });
    }
  }
  openGitFiles()

  context.subscriptions.push(disposable);

  context.subscriptions.push(
    vscode.commands.registerCommand("alpine.show", () => {
      vscode.window.showInformationMessage("alpine.show triggerred.....");
    })
  );

  //Adding WebView

  // Create and show panel
  const panel = vscode.window.createWebviewPanel(
    "webview-1",
    "Hello World View",
    vscode.ViewColumn.One,
    {}
  );

  // And set its HTML content
  panel.webview.html = getWebviewContent();

  context.subscriptions.push(panel);

  const panel2 = vscode.window.createWebviewPanel(
    "webview-2",
    "Second View",
    vscode.ViewColumn.One,
    {}
  );

  // And set its HTML content
  panel2.webview.html = getWebviewContent();

  context.subscriptions.push(panel2);

  const panel3 = vscode.window.createWebviewPanel(
    "webview-2",
    "Third View",
    vscode.ViewColumn.One,
    {}
  );

  // And set its HTML content
  panel3.webview.html = getWebviewContent();

  context.subscriptions.push(panel3);

  // making background API

  function makeAPICall(triggerCmd) {
    axios
      .post(
        "http://127.0.0.1:3000/vsextension",
        vscode.workspace.getConfiguration(),
        { "Content-Type": "application/json" }
      )
      .then((response) => {
        // console.log(response?.status
        if (response?.status === 200) {
          // response.send("reached.....")
          if (!triggerCmd) {
            vscode.window.showInformationMessage(
              "Background API has been triggerred...."
            );
          } else {
            vscode.window.showInformationMessage("API has been invoked....");
          }
        } else {
          // Unexpected response
          console.log(response);
          vscode.window.showErrorMessage(response);
        }
      })
      .catch((error) => {
        // API has returned an error
        // const strError = `Taxi for Email: ${error.response.status} - ${error.response.statusText}`;
        console.log(error);
        // vscode.window.showErrorMessage(strError);
      });
  }
  makeAPICall();

  // Attaching API call to command

  context.subscriptions.push(
    vscode.commands.registerCommand("invoke-api", () => {
      makeAPICall("triggerred");
    })
  );
}

// This method is called when your extension is deactivated
async function deactivate() {
  await axios.get("http://127.0.0.1:3000/sample");
  console.log("deactivated");
}

function getWebviewContent() {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Cat Coding</title>

	  <style>
table, th, td {
  border:1px solid white;
}
</style>
  </head>
  <body>
	  <h1>Hello World</h1>

<h2>TH elements define table headers</h2>

<table style="width:100%">
  <tr>
    <th>Person 1</th>
    <th>Person 2</th>
    <th>Person 3</th>
  </tr>
  <tr>
    <td>Emil</td>
    <td>Tobias</td>
    <td>Linus</td>
  </tr>
  <tr>
    <td>16</td>
    <td>14</td>
    <td>10</td>
  </tr>
</table>

<p>sample table</p>

  </body>
  </html>`;
}

module.exports = {
  activate,
  deactivate,
};
