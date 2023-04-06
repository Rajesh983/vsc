const { EventEmitter } = require("vscode");
const passthrough = (value, resolve) => resolve(value);
  function promiseFromEvent(event, adapter = passthrough) {
	let subscription;
	let cancel = new EventEmitter();
	return {
		promise: new Promise((resolve, reject) => {
			cancel.event(_ => reject('Cancelled'));
			subscription = event((value) => {
				try {
					Promise.resolve(adapter(value, resolve, reject))
						.catch(reject);
				} catch (error) {
					reject(error);
				}
			});
		}).then(
			(result) => {
				subscription.dispose();
				return result;
			},
			error => {
				subscription.dispose();
				throw error;
			}
		),
		cancel
	};
}


module.exports = {promiseFromEvent}