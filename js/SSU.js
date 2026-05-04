fetch('/json/data.json')
    .then(response => response.json())
    .then(data => {
        // Chama uma função para preencher os campos do formulário com os dados do JSON
        preencherCamposFormulario(data);
    })
    .catch(error => {
        console.error('Erro ao carregar arquivo JSON:', error);
    });

    function preencherCamposFormulario(data) {
    // Preenche o campo de centro de custo com os dados do JSON
        const centroCustoSelect = document.getElementById('centro-custo');
        data.CentroCusto.forEach(cc => {
            const option = document.createElement('option');
            option.value = cc;
            option.textContent = cc;
            centroCustoSelect.appendChild(option);
        });
        // Preenche o campo de operação com os dados do JSON
        const operacaoSelect = document.getElementById('operacao');
        data.Operacao.forEach(op => {
            const option = document.createElement('option');
            option.value = op;
            option.textContent = op;
            operacaoSelect.appendChild(option);
        });
}

function preencherSelectMaquinas(data) {
    const maquinasSelect = document.getElementById('maquina');
    // Limpa as opções anteriores do <select> de máquinas
    maquinasSelect.innerHTML = '';

    // Preenche as novas opções do <select> de máquinas com os dados recebidos
    data.forEach(maquina => {
        const option = document.createElement('option');
        option.value = maquina.id; // Supondo que cada máquina tenha um ID único
        option.textContent = maquina.nome; // Supondo que o nome da máquina seja fornecido pelo servidor
        maquinasSelect.appendChild(option);
    });
}