import { $, dom } from './state.js';

export function showConfirm(title, message, opts = {}) {
  const { confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = opts;
  $('#dialogTitle').textContent = title;
  $('#dialogMessage').textContent = message;
  const confirmBtn = $('#dialogConfirm');
  confirmBtn.textContent = confirmText;
  confirmBtn.className = danger ? 'pp-btn pp-btn--danger' : 'pp-btn pp-btn--primary';
  $('#dialogCancel').textContent = cancelText;

  return new Promise((resolve) => {
    function onConfirm() { cleanup(); dom.confirmDialog.close(); resolve(true); }
    function onCancel() { cleanup(); dom.confirmDialog.close(); resolve(false); }
    function cleanup() {
      confirmBtn.removeEventListener('click', onConfirm);
      $('#dialogCancel').removeEventListener('click', onCancel);
      dom.confirmDialog.removeEventListener('cancel', onCancel);
    }
    confirmBtn.addEventListener('click', onConfirm);
    $('#dialogCancel').addEventListener('click', onCancel);
    dom.confirmDialog.addEventListener('cancel', onCancel);
    dom.confirmDialog.showModal();
  });
}
