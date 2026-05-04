let inactivityTimeout;

function showMessage() {
  const popup = document.getElementById('popup');
  popup.style.display = 'flex';

    // Define o tempo (em milissegundos) para exibir a mensagem (por exemplo, 5 segundos)
    const displayTime = 500000;

    // Configura um temporizador para ocultar a mensagem após o tempo definido
    inactivityTimeout = setTimeout(function () {
      hidePopup();
      redirectToHomePage();
  }, displayTime);
}

function hidePopup() {
  const popup = document.getElementById('popup');
  popup.style.display = 'none';
}

function resetInactivityTimer() {
    // Limpa o temporizador existente e define um novo temporizador
    clearTimeout(inactivityTimeout);
    showMessage();
}

function redirectToHomePage() {
    // Redireciona para a tela inicial (substitua "index.html" pelo nome do arquivo da tela inicial)
    window.location.href = "/login.html";
}

// Evento para detectar movimentação do mouse e redefinir o temporizador
document.addEventListener('mousemove', resetInactivityTimer);