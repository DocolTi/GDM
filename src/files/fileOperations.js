const fs = require('fs').promises;
const path = require('path');

async function openFip(req, res) {

    const fipN = req.params.id;
    console.log(fipN + " teste"); // Para debug

    // Validação do ID
    if (!/^[a-zA-Z0-9_-]+$/.test(fipN)) {
        return res.status(400).send('ID inválido');
    }

    const baseNetworkPath = '\\\\dfs\\SAP\\PP\\QUA\\FIP-PDF';
    const filePath = path.join(baseNetworkPath, `00001.pdf`); // Construindo o caminho do arquivo

    // Verifica se o arquivo existe
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).send('Arquivo não encontrado');
        }
        // Se o arquivo existir, envia o arquivo
        // Para forçar download, você pode descomentar a linha abaixo
        // res.setHeader('Content-Disposition', 'attachment; filename="' + fipN + '.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        fs.createReadStream(filePath).pipe(res);
    });
}

async function printZPL(req, res) {
    const { printerDirectory, zplData, qtdetq } = req.body;
    const printerDir = `//172.18.1.232/${printerDirectory.trim()}`;
    const fileName = 'label_template.zpl';
    const filePath = path.join(printerDir, fileName);

    try {
        for (let i = 0; i < qtdetq; i++) {
            await fs.writeFile(filePath, zplData.trim());
        }
        res.send('Impressão enviada com sucesso.');
    } catch (err) {
        console.error('Erro ao escrever arquivo ZPL:', err);
        res.status(500).send('Erro na impressão.');
    }
}

module.exports = {
    openFip,
    printZPL,
};
