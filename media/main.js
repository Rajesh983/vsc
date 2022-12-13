// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {

    const vscode = acquireVsCodeApi();
    window.vscodeApi = vscode;
    const previousState = vscode.getState();
    console.log({ previousState })

    //vscode.setState({event:"Not_Logged_In",repo:{}})

    function handleMessage(message) {
        switch (message.type) {
            case "logged_in":

                 vscode.setState({event:"Logged_In",repo:message.repo})

                let btnContainer = document.createElement('div')
                btnContainer.id = 'btn-container'

                let paraEle = document.createElement('p')
                paraEle.textContent = 'Successfully logged in.....'
                btnContainer.appendChild(paraEle)


                if (Object.keys(message.repo).length !== 0) {
                    let repoNameEl = document.createElement('p')
                    repoNameEl.textContent = 'Project : ' + message.repo.repoName
                    repoNameEl.style.color = 'yellow'
                    btnContainer.appendChild(repoNameEl)

                    let ownerNameEl = document.createElement('p')
                    ownerNameEl.textContent = 'OwnerId : '+message.repo.ownerUsername
                    ownerNameEl.style.color = 'yellow'
                    btnContainer.appendChild(ownerNameEl)
                }

                let logoutBtnEl = document.createElement('button')
                logoutBtnEl.textContent = 'Logout'
                logoutBtnEl.classList.add('login-btn')
                logoutBtnEl.addEventListener('click', () => {
                    console.log("logout clicked....")
                    vscode.postMessage({ type: "not_logged_in" })
                    vscode.setState({event:'Logged_In',repo:{}})
                });
                
                btnContainer.appendChild(logoutBtnEl)


                document.body.appendChild(btnContainer)
                break
            default:
                vscode.setState({event:"Not_Logged_In",repo:{}})

                let containerEl = document.createElement('div')
                containerEl.id = 'login-container'
                document.body.appendChild(containerEl)

                let headEl = document.createElement('h1')
                headEl.textContent = 'Login'
                containerEl.appendChild(headEl)

                let paraEl = document.createElement('p')
                paraEl.textContent = 'Please sign in to continue.'
                containerEl.appendChild(paraEl)


                let btnEl = document.createElement('button')
                btnEl.textContent = 'Login with GitHub'
                btnEl.classList.add('login-btn')
                btnEl.addEventListener('click', () => {
                    console.log("login clicked....")
                    vscode.postMessage({ type: "logged_in" })
                    vscode.setState({event:'Logged_In',repo:{}})
                });
                containerEl.appendChild(btnEl)

        }
    }


     if(previousState === undefined){
        handleMessage({ type: 'not_logged_in' })
     }
    else if (previousState.event === "Logged_In") {
        console.log("if blockkkkk")
        if (document.getElementById('btn-container')) {
            document.getElementById('btn-container').remove()
        }
        if (document.getElementById('login-container')) {
            document.getElementById('login-container').remove()
        }
        handleMessage({ type: 'logged_in',repo:previousState.repo })
        //vscode.postMessage({type:"logged_in"})
    } else {
        console.log("else blockkkkk")
        if (document.getElementById('btn-container')) {
            document.getElementById('btn-container').remove()
        }
        if (document.getElementById('login-container')) {
            document.getElementById('login-container').remove()
        }
        handleMessage({ type: 'not_logged_in' })
    }

    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        console.log({ message })
        if (document.getElementById('btn-container')) {
            document.getElementById('btn-container').remove()
        }
        if (document.getElementById('login-container')) {
            document.getElementById('login-container').remove()
        }
        handleMessage(message)
    });


}());



