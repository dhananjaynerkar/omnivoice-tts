const vscode = require('vscode');
const http = require('http');

let statusBarItem;

function activate(context) {
  console.log('[Universal Reader TTS] Extension activated.');

  // 1. Status Bar Item for Reading Selected Portion
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'universalReader.readSelection';
  statusBarItem.text = '$(unmute) Read Selection';
  statusBarItem.tooltip = 'Universal Reader: Click to read selected portion aloud (or press F8 with companion running)';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // 2. Command: Read Selected Portion (or copied text in Markdown Preview)
  const readSelectionCmd = vscode.commands.registerCommand('universalReader.readSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    let text = '';

    if (editor && editor.selection && !editor.selection.isEmpty) {
      text = editor.document.getText(editor.selection);
    } else {
      // In Markdown Preview / Webviews, read text from clipboard
      try {
        text = await vscode.env.clipboard.readText();
      } catch (e) {
        text = '';
      }
    }

    if (!text || !text.trim()) {
      vscode.window.showInformationMessage(
        'Universal Reader: Please highlight text, or press Ctrl+C in Markdown Preview, then click Read.'
      );
      return;
    }

    const preview = text.trim().slice(0, 35).replace(/\n/g, ' ');
    vscode.window.setStatusBarMessage(`🔊 Universal Reader: Reading "${preview}..."`, 4000);
    speakText(text.trim());
  });

  // 3. Command: Stop Speech
  const stopCmd = vscode.commands.registerCommand('universalReader.stopPlayback', () => {
    sendToCompanion('/stop', {}, (err) => {
      if (err) {
        vscode.window.showWarningMessage('Universal Reader: Could not reach companion to stop speech.');
      } else {
        vscode.window.setStatusBarMessage('⏹ Universal Reader: Speech stopped.', 2500);
      }
    });
  });

  context.subscriptions.push(readSelectionCmd, stopCmd);
}

function speakText(text) {
  sendToCompanion('/speak', { text }, (err) => {
    if (err) {
      vscode.window.showErrorMessage(
        'Universal Reader Companion is not running. Please double-click START.bat to start it.'
      );
    }
  });
}

function sendToCompanion(endpoint, data, callback) {
  const payload = JSON.stringify(data);
  const options = {
    hostname: '127.0.0.1',
    port: 8765,
    path: endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    },
    timeout: 3000
  };

  const req = http.request(options, (res) => {
    // Consume response data to free up memory
    res.resume();
    if (res.statusCode >= 200 && res.statusCode < 300) {
      callback(null);
    } else {
      callback(new Error(`HTTP ${res.statusCode}`));
    }
  });

  req.on('error', (err) => {
    callback(err);
  });

  req.on('timeout', () => {
    req.destroy();
    callback(new Error('Timeout connecting to companion'));
  });

  req.write(payload);
  req.end();
}

function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}

module.exports = {
  activate,
  deactivate
};
