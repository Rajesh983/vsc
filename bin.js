


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




  "authentication": [
    {
      "label": "GitHub",
      "id": "github"
    },
    {
      "label": "GitHub Enterprise Server",
      "id": "github-enterprise"
    }
  ],


  "capabilities": {
    "virtualWorkspaces": true,
    "untrustedWorkspaces": {
      "supported": "limited",
      "restrictedConfigurations": [
        "github-enterprise.uri"
      ]
    }
  },





  //current tree view 

import * as vscode from 'vscode';
import * as path from 'path';

class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
    onDidChangeTreeData?: vscode.Event<TreeItem | null | undefined> | undefined;

    treeFiles: any
    fileTreeItems: any

    constructor() {
        const filesObj = {
            displayName: "Files Tree",
            children: [{ displayName: "Sample sub", children: [{ name: 'index.js', filePath: '/.8800/index.js' }]}],
        }
        this.treeFiles = filesObj;
        this.fileTreeItems = this.convertFilesToTreeItems();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element: any) {
        if (element) {
            return element.getTreeViewChildren();
        } else {
            return this.fileTreeItems;
        }
    }


    convertFilesToTreeItems() {
        let array = [];
        array.push(
            new fileTreeItem(this.treeFiles, vscode.TreeItemCollapsibleState.Collapsed),
            new fileTreeItem(this.treeFiles, vscode.TreeItemCollapsibleState.Collapsed)
        );
        return array;
    }
}



class fileTreeItem {
    displayDetails: any
    label: any
    collapsibleState: any
    positionDetails: any

    // we must provide the property label for it to show up the tree view
    constructor(displayDetails: any, collapsibleState: any) {
        this.displayDetails = displayDetails;
        this.label = `${displayDetails.displayName}`;
        this.collapsibleState = collapsibleState;
        this.positionDetails = [];
        this.convertChildrenToTreeItems();
    }

    // Convert each property in displayDetails.position to a TreeItem which is treated as child of the file tree item
    convertChildrenToTreeItems() {
        if (this.displayDetails.children) {
            const res = this.displayDetails.children.map((files: any) => new TreeItem(files.name, files.filePath))
            this.positionDetails = res;
        }
    }

    getTreeViewChildren() {
        return this.positionDetails;
    }
}

class TreeItem extends vscode.TreeItem {
    constructor(label: any, filePath: any) {
        super(label);
        this.resourceUri = vscode.Uri.file(filePath)
        const command = {
            "command": "open.file",
            "title": "Open file",
            arguments: [filePath]
        }

        this.command = command;
    }
}



export default TreeDataProvider









