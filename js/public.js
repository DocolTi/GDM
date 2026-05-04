document.getElementById("INFO1").src = "http://GDI.docol.com.br/GDM/img/icons8-logout-96.png";

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 Validação da authenticação do usuário 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

window.onload = () => {
    // Verificar se o usuário está autenticado
    const usuarioLogado = localStorage.getItem('usuarioLogado');
    if (usuarioLogado !== 'true') {
        // Usuário não está autenticado; redirecionar para a página de login
        window.location.href = 'http://GDI.docol.com.br/GDM/login.html';
    }
};

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 Validação da authenticação do usuário 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

async function carregarValores0() {
    try {
        // Remove todos os dados do usuário do localStorage
        localStorage.removeItem('usuarioLogado');
        localStorage.removeItem('username');
        localStorage.removeItem('nome');
        localStorage.removeItem('auth');
        localStorage.removeItem('cad');
        localStorage.removeItem('prof');
        localStorage.removeItem('email');
        localStorage.removeItem('acess');
        localStorage.removeItem('obs');
        localStorage.removeItem('Matricula');
        localStorage.removeItem('nomeUsuario');
        // Outros dados da aplicação
        localStorage.removeItem('resultados');
        localStorage.removeItem('dadosDetalhados');
        localStorage.removeItem('filtros');
        localStorage.removeItem('cardPositions');

        // Se chegou até aqui, significa que não houve erro
        showSuccessMessage('7'); // Mensagem de sucesso

        // Aguarda um pouco antes de redirecionar para dar tempo da mensagem ser vista
        setTimeout(() => {
            window.location.href = 'http://GDI.docol.com.br/GDM/login.html';
        }, 2500); // Ajuste o tempo conforme necessário

    } catch (error) {
        // Em caso de erro na operação
        console.error(error); // Log do erro
        showSuccessMessage('4'); // Chama a mensagem de erro

        // Opcional: redirecionar mesmo assim ou tratar o erro de outra forma
    }
}

function carregarValores() {
    window.location.href = 'http://GDI.docol.com.br/GDM/html/Menu.html'
}

function carregarValores1() {
    window.location.href = '/login.html'
} 

// Função assíncrona para exibir uma mensagem de sucesso baseada em um ID
async function showSuccessMessage(messageId) {
    console.log('teste')
    try {
        // Carrega o JSON com as mensagens
        const response = await fetch('http://GDI.docol.com.br/GDM/json/IdMsg.json'); // Atualize o caminho conforme necessário
        if (!response.ok) {
            throw new Error('Falha ao carregar mensagens');
        }

        const messages = await response.json();
        // Busca a mensagem pelo ID
        const messageData = messages.find(msg => msg.IdMsg === messageId);
        if (!messageData) {
            throw new Error('Mensagem não encontrada');
        }

        let successMessage = document.getElementById('successMessage');
        if (!successMessage) {
            successMessage = document.createElement('div');
            successMessage.id = 'successMessage';
            successMessage.className = 'success-message';
            document.body.appendChild(successMessage);
        }

        // Atualiza o conteúdo da mensagem
        successMessage.innerHTML = `
            <img src="${messageData.caminhoImagem}" alt="Imagem de Sucesso" class="success-image">
            <div class="success-text">${messageData.descricao}</div>
        `;

        // Exibe a mensagem
        successMessage.style.display = 'block';

        // Oculta a mensagem após 2 segundos
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 2000);

    } catch (error) {
        console.error('Erro ao exibir a mensagem de sucesso:', error);
    }
}


// Atualiza a altura do header na variável CSS
function updateSidebarTop() {
  const header = document.querySelector('.header');
  if (header) {
    const headerHeight = header.offsetHeight + 'px';
    document.documentElement.style.setProperty('--header-height', headerHeight);
  }
}

// Atualiza ao carregar, ao redimensionar e quando o conteúdo do header mudar
window.addEventListener('DOMContentLoaded', updateSidebarTop);
window.addEventListener('resize', updateSidebarTop);

// Se o header pode mudar de tamanho dinamicamente (ex: filtros abrindo/fechando)
const header = document.querySelector('.header');
if (header && window.ResizeObserver) {
  const resizeObserver = new ResizeObserver(updateSidebarTop);
  resizeObserver.observe(header);
}