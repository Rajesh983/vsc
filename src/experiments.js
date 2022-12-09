const vscode = require("vscode");
const { posix } = require('path');

let total = 0;
let count = 0;
let files = [];

class DataProvider {


   constructor (filesList,stageFilesList) {
        // files=[];

        //vscode.window.registerFileDecorationProvider(this)
            const changeFilesObj = {
                changePosition: filesList,
                stagePosition:stageFilesList
            }
        this.changeTreeFiles = changeFilesObj;
        this.fileTreeItems = this.convertFilesToTreeItems();
    
        
  }

   _onDidChangeTreeData= new vscode.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh() {
        this._onDidChangeTreeData.fire();
    }

  // provideFileDecoration(uri) {
  //   return {
  //     badge: "~",
  //     tooltip: "Files count"
  //   };
  // }


  gettingUpdatedFilesList(filesList,stageFilesList){
    const changeFilesObj = {
      changePosition: filesList,
      stagePosition:stageFilesList
  }
  this.changeTreeFiles = changeFilesObj
  this.fileTreeItems = this.convertFilesToTreeItems();
  
  }


  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (element) {
      return element.getPositionDetails();
    } else {
      return this.fileTreeItems;
    }
    
  }

 

  convertFilesToTreeItems() {
    let array = [];

    const changeObj = {
      displayName:"Changes",
      changePosition: this.changeTreeFiles.changePosition
    }

    const stageObj = {
      displayName:"Staged Changes",
      changePosition:this.changeTreeFiles.stagePosition
    }

    if(changeObj.changePosition.length !== 0 && stageObj.changePosition.length !== 0){
      array.push(
        new fileTreeItem(changeObj, vscode.TreeItemCollapsibleState.Expanded),
        new fileTreeItem(stageObj, vscode.TreeItemCollapsibleState.Expanded)
      )
    }else if(changeObj.changePosition.length !== 0 && stageObj.changePosition.length === 0){
      array.push(
        new fileTreeItem(changeObj, vscode.TreeItemCollapsibleState.Expanded),
      )
    }else{
      array.push(
        new fileTreeItem(stageObj, vscode.TreeItemCollapsibleState.Expanded),
      )
    }

        
    return array;
  }

  
 

}

class fileTreeItem {
  // we must provide the property label for it to show up the tree view
  constructor(displayDetails, collapsibleState) {
    this.displayDetails = displayDetails;
    this.label = `${displayDetails.displayName}`;
    this.collapsibleState = collapsibleState;
    this.positionDetails = [];
    this.convertPositionToTreeItems();
  }

  // Convert each property in displayDetails.position to a TreeItem which is treated as child of the file tree item
  convertPositionToTreeItems() {
    
    if (this.displayDetails.changePosition) {
        const res = this.displayDetails.changePosition.map((files)=> new TreeItem(files.name ,files.filePath,files.fileResource))
    
        this.positionDetails = res;
     
    }
  }

  getPositionDetails() {
    return this.positionDetails;
  }
}

class TreeItem extends vscode.TreeItem {
    constructor(label,filePath,fileResource) {
        super(label);
        this.resourceUri = vscode.Uri.file(filePath)
        const command = {
            "command": "open.file",
            "title": "Open file",
            arguments : [fileResource]
          }

          this.command = command;
    }

   
  
}

module.exports = DataProvider;
