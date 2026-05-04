// auth.js

// Função para fazer login do usuário
function fazerLogin(usuario, senha) {
    // Aqui você faria a autenticação do usuário, por exemplo, com uma requisição para o servidor
    // Se o login for bem-sucedido, você recebe um token de acesso do servidor
    const token = "token_de_acesso_gerado_pelo_servidor";

    // Armazena o token de acesso no Local Storage
    localStorage.setItem('token', token);
}

// Função para verificar se o usuário está autenticado
function verificarAutenticacao() {
    // Verifica se o token de acesso está presente no Local Storage
    const token = localStorage.getItem('token');
    return token !== null; // Retorna true se o token estiver presente, indicando que o usuário está autenticado
}

// Função para fazer logout do usuário
function fazerLogout() {
    // Remove o token de acesso do Local Storage
    localStorage.removeItem('token');
}