require("dotenv").config();

const express = require('express');
const ping = require('ping');
const fs1 = require('fs'); // Importação correta para usar Promises
const fs = require('fs').promises; // Importação correta para usar Promises
const path = require('path');
const app = express();
const port = process.env.PORT;
const db = require('../js/db'); // Importe o arquivo db.js
const cors = require('cors'); // Importe o pacote CORS

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Middleware para analisar os corpos das requisições URL-encoded


app.use(cors({
  //origin: 'http://gdi.docol.com.br'
}));

app.use(async (req, res, next) => {
    try {
        const connection = await db.getConnection();
        if (connection && connection.connected) {
            const freeConnections = connection.pool.numFree ? connection.pool.numFree() : 'desconhecido';
            console.log(`[${new Date().toISOString()}] Rota: ${req.method} ${req.url} | Conexões livres: ${freeConnections} | Conexão ativa: ${connection.connected}`);
        }
    } catch (error) {
        console.error('Erro ao logar conexões:', error);
    }
    next();
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 rota principal 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.get('/', (req, res) => res.json({ message: 'Funcionando!' }));
//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 CMG Carga Máquina 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

const fileUpload = require('express-fileupload');
const csv = require('csv-parser');

app.use(fileUpload());
const BASE_URL = '/upload-csv';
const uploadPath = path.join(__dirname, '/uploads');

// Cria o diretório de uploads se não existir
if (!fs1.existsSync(uploadPath)) {
    fs1.mkdirSync(uploadPath, { recursive: true });
}

app.post(BASE_URL, async (req, res) => {
    if (!req.files || !req.files.csvFile) {
        return res.status(400).send('No file uploaded.');
    }

    const file = req.files.csvFile;
    const results = [];

    try {
        // Mover o arquivo para o local temporário
        const tempFilePath = path.join(uploadPath, 'temp.csv');
        await file.mv(tempFilePath);

        // Processar o arquivo CSV
        await new Promise((resolve, reject) => {
            fs1.createReadStream(tempFilePath)
                .pipe(csv({ separator: ';' })) // Use o separador correto se não for vírgula
                .on('data', (data) => {
                    console.log('CSV Data:', data); // Adicione este log para depuração
                    results.push(data);
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Verifique se há dados
        if (results.length === 0) {
            return res.status(500).send('No data found in CSV file.');
        }

        // Inserir dados no banco de dados
        await db.insertCSVData(results);

        // Opcional: Remover o arquivo temporário após o processamento
        //fs1.unlinkSync(tempFilePath);

        res.send('File uploaded and processed.');
    } catch (error) {
        console.error('Error processing CSV file:', error);
        res.status(500).send('Error processing CSV file.');
    }
});


// Endpoint para obter dados
app.get('/select_cargaMaq', async (req, res) => {
    try {
        const setups = await db.select_cargaMaq(); // Chame a função que obtém os setups do banco de dados
        res.status(200).json(setups); // Envie os setups obtidos como resposta
    } catch (error) {
        console.error('Erro ao buscar Apontamento:', error);
        res.status(500).json({ error: 'Erro ao buscar Apontamento' });
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 LOGIN 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await db.selectLogin(username, password);
        if (result.length > 0) {
            const user = result[0];
            // Retorne todos os campos relevantes do usuário
            res.status(200).json({
                success: true,
                message: "Login bem-sucedido",
                username: user.username,
                Nome: user.Nome,
                auth: user.auth,
                cad: user.cad,
                prof: user.prof,
                email: user.email,
                acess: user.acess,
                obs: user.obs,
                Matricula: user.Matricula // se existir
            });
        } else {
            res.status(401).json({ success: false, message: "Credenciais inválidas" });
        }
    } catch (error) {
        console.error('Erro ao tentar fazer login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});
//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥CAD - Cadastro de Usuário 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥
// Verificar existência (para o front consultar antes de cadastrar)
app.get('/users/exists/:username', async (req, res) => {
    try {
        const exists = await db.usernameExists(req.params.username.trim());
        res.status(200).json({ exists });
    } catch (err) {
        console.error('Erro ao verificar username:', err);
        res.status(500).json({ error: 'Erro ao verificar username' });
    }
});

app.post('/insert_CAD', async (req, res) => {
    try {
        // Normalizações simples
        const {
        username = '',
        password = '',
        nome = '',
        auth = '',
        cad = '',
        prof = '',
        email = '',
        acess = '',
        obs = ''
        } = req.body;

        const normUsername = String(username).trim(); // pode padronizar para lower-case se quiser
        if (!normUsername) return res.status(400).json({ error: 'username obrigatório' });

        const result = await db.insert_CAD(
        normUsername, password, nome, auth, cad, prof, email, acess, obs
        );

        res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
        if (error.code === 'USERNAME_ALREADY_EXISTS') {
        return res.status(409).json({ success: false, error: 'Usuário já existe' });
        }
        console.error('Erro ao adicionar Usuário:', error);
        res.status(500).json({ success: false, error: 'Erro ao adicionar Usuário' });
    }
});

app.get('/select_CAD', async (req, res) => {
    try {
        const usuarios = await db.select_CAD();
        res.status(200).json(usuarios);
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

// Buscar 1 usuário
app.get('/users/:id', async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.status(200).json(user);
  } catch (err) {
    console.error('Erro ao buscar usuário:', {
      message: err.message,
      number: err.number,     // códigos SQL Server (ex.: 207 coluna inválida)
      stack: err.stack
    });
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Atualizar usuário
app.put('/users/:id', async (req, res) => {
try {
    const id = req.params.id;

    const {
    username = '',
    password = '', // opcional
    nome = '',
    auth = '',
    cad = '',
    prof = '',
    email = '',
    acess = '',
    obs = ''
    } = req.body;

    const updated = await db.update_CAD({
    id,
    username: String(username).trim(),
    password,
    nome, auth, cad, prof, email, acess, obs
    });

    res.status(200).json({ success: true, id: updated.Id || id });
} catch (err) {
    if (err.code === 'USERNAME_ALREADY_EXISTS') {
    return res.status(409).json({ success: false, error: 'Usuário já existe' });
    }
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar usuário' });
}
});
//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 APF APONTAMENTO 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.post('/ferr_apont', async (req, res) => {
    const { login, n_op, n_ope, n_user, n_tur, trab_real, uni_trab, conf_final, data_lanc, data_ini, hora_ini, data_fim, hora_fim, status, obs} = req.body;

    try {
        const result = await db.insertferr_apont( login, n_op, n_ope, n_user, n_tur, trab_real, uni_trab, conf_final, data_lanc, data_ini, hora_ini, data_fim, hora_fim, status, obs);
        res.status(201).json({ message: 'Apontamento adicionado com sucesso', id: result.insertId });
    } catch (error) {
        console.error('Erro ao adicionar Apontamento:', error);
        res.status(500).json({ error: 'Erro ao adicionar Apontamento' });
    }
});

app.get('/ferr_apont', async (req, res) => {
    try {
        const setups = await db.selectferr_apont(); // Chame a função que obtém os setups do banco de dados
        res.status(200).json(setups); // Envie os setups obtidos como resposta
    } catch (error) {
        console.error('Erro ao buscar Apontamento:', error);
        res.status(500).json({ error: 'Erro ao buscar Apontamento' });
    }
});

app.put('/ferr_apont/:id', async (req, res) => {
    const { id } = req.params;
    const { trab_real, conf_final, data_fim, hora_fim, status, obs } = req.body;

    try {
        const result = await db.update_ferr_apont(id, trab_real, conf_final, data_fim, hora_fim, status, obs);
        res.status(200).json({ message: 'Apontamento atualizado com sucesso.', id: result });
    } catch (error) {
        console.error('Erro ao atualizar o apontamento:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar o apontamento.' });
    }
});
//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 SSU FIP 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥
app.get('/pdfabrir/:fipN', async (req, res) => {
    const fipN = req.params.fipN;

    // Validação do ID
    if (!/^[a-zA-Z0-9_-]+$/.test(fipN)) {
        return res.status(400).send('ID inválido');
    }

    const baseNetworkPath = '\\\\dfs\\SAP\\PP\\QUA\\FIP-PDF';
    const filePath = path.join(baseNetworkPath, `${fipN}.pdf`);

    try {
        // Verifique se o arquivo existe
        await fs1.promises.access(filePath, fs1.constants.F_OK);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="' + fipN + '.pdf"');
        const stream = fs1.createReadStream(filePath);
        stream.pipe(res);
    } catch (err) {
        console.error('Erro ao acessar o arquivo:', err);
        return res.status(404).send('Arquivo não encontrado');
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 SSU PDF 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥
app.get('/pdf/:id', async(req, res) => {
    const id = req.params.id;

    const result = await db.getItemByFipN(id);
    res.status(200).json(result); 
    
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 SSU ADICIONAR 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.post('/setupusi', async (req, res) => {
    const { HRpedido, login, cc, maquina, item, operacao, lote, horario, status, calibrador, HRfinalizado, obs} = req.body;

    try {
        const result = await db.insertCustomer( HRpedido, login, cc, maquina, item, operacao, lote, horario, status, calibrador, HRfinalizado, obs);
        res.status(201).json({ message: 'Setup adicionado com sucesso', id: result.insertId });
    } catch (error) {
        console.error('Erro ao adicionar Setup:', error);
        res.status(500).json({ error: 'Erro ao adicionar Setup' });
    }
});

app.get('/setupusi', async (req, res) => {
    try {
        const setups = await db.selectCustomers(); // Chame a função que obtém os setups do banco de dados
        res.status(200).json(setups); // Envie os setups obtidos como resposta
    } catch (error) {
        console.error('Erro ao buscar setups:', error);
        res.status(500).json({ error: 'Erro ao buscar setups' });
    }
});

app.put('/atualizar-status/:id', async (req, res) => {
    const setupId = req.params.id;
    const { status } = req.body;

    try {
        const result = await db.updateStatus(setupId, status);
        res.status(200).json({ message: 'Status atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar o status:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar o status.' });
    }
});

app.delete('/setupusi/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const result = await db.excluirSetupUsiPorId(id);
        res.status(200).json({ message: 'Setup de usinagem excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir setup de usinagem:', error);
        res.status(500).json({ error: 'Erro ao excluir setup de usinagem' });
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 SSU SELECT MÁQ 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.get('/maquinas', async (req, res) => {
    const centroCusto = req.query.centroCusto;
    try {
        const maquinas = await db.getMaquinasPorCentroCusto(centroCusto);
        res.status(200).json(maquinas);
    } catch (error) {
        console.error('Erro ao obter máquinas:', error);
        res.status(500).json({ error: 'Erro ao obter máquinas' });
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 SSU FOLHA PROCESSO 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.get('/setupusiFolha', async (req, res) => {
    const item = req.query.item;
    try {
        const docu = await db.getFolhaProcessoItem(item);
        res.status(200).json(docu);
    } catch (error) {
        console.error('Erro ao obter Folha Processo:', error);
        res.status(500).json({ error: 'Erro ao obter Folha Processo' });
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 ETQ SELECT 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.get('/getEtiquetaById/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const result = await db.buscarEtiquetaPorId(id);
        res.status(200).json(result);
    } catch (error) {
        console.error('Erro ao obter Etiqueta:', error);
        res.status(500).json({ error: 'Erro ao obter Etiquetanas' });
    }
});
//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 ETQ IMPRIMIR 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥
async function readData() {
    const filePath = path.join(__dirname, '..', 'json', 'data.json');
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}

app.get('/ping', async (req, res) => {
    try {
        const data = await readData();
        const devices = data.Impressoras;
        const pingPromises = devices.map(device => 
            ping.promise.probe(device.ip).then(result => ({
                numero: device.numero,
                modelo: device.modelo,
                status2: device.status2,
                name: device.name,
                cc: device.cc,
                local: device.local,
                fabrica: device.fabrica,
                ip: device.ip,
                alive: result.alive
            }))
        );
        const pingResults = await Promise.all(pingPromises);
        res.json(pingResults);
    } catch (error) {
        console.error('Erro ao ler os dados ou executar o ping:', error);
        res.status(500).send('Erro ao processar a solicitação');
    }
});


const shell = require('shelljs');

app.post('/zplReset', async (req, res) => {
    const { printerDirectory } = req.body;
    const printerDir = "//172.18.1.232/" + printerDirectory.trim();

    try {
        // Primeiro arquivo ZPL
        const zplData1 = '^XA^JUF^XZ'; // Exemplo de ZPL (você pode ajustar o conteúdo)
        const zplFilePath1 = path.join(printerDir, 'label_part1.zpl');
        await fs.writeFile(zplFilePath1, zplData1);

        // Segundo arquivo ZPL
        const zplData2 = 'XA^JUS^~SD25^XZ'; // Outro exemplo de ZPL
        const zplFilePath2 = path.join(printerDir, 'label_part2.zpl');
        await fs.writeFile(zplFilePath2, zplData2);

        // Você pode usar shelljs para enviar os arquivos à impressora se necessário
        // Exemplo: shell.exec(`copy ${zplFilePath1} ${printerDir}`);
        // shell.exec(`copy ${zplFilePath2} ${printerDir}`);

        res.json({ success: true, message: "ZPL enviado em dois arquivos." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Erro ao enviar ZPL." });
    }
});

app.post('/zplConfig1', async (req, res) => {
    const { qtdTemp, printerDirectory } = req.body;
    const printerDir = "//172.18.1.232/" + printerDirectory.trim();

    // Checando se os valores estão corretos
    if (!qtdTemp || !printerDirectory) {
        return res.status(400).json({ success: false, message: "Temperatura ou diretório da impressora não fornecidos." });
    }

    try {
        // Gerar o conteúdo ZPL com a temperatura dinâmica
        const zplData = `^XA^JUS^~SD${qtdTemp}^XZ`;

        // Salvar o arquivo ZPL na pasta da impressora
        const zplFilePath = path.join(printerDir, 'vagao.zpl');
        await fs.writeFile(zplFilePath, zplData);

        res.json({ success: true, message: `Temperatura ajustada para ${qtdTemp}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Erro ao enviar o ZPL." });
    }
});

app.post('/zplConfig2', async (req, res) => {
    const { qtdTemp1, qtdTemp2, printerDirectory, infetq2 } = req.body;
    const printerDir = "//172.18.1.232/" + printerDirectory.trim();

    // Validação de campos obrigatórios
    if (!printerDirectory) {
        return res.status(400).json({ success: false, message: "Diretório da impressora não fornecido." });
    }

    // Obtém a data atual no formato desejado (dd/MM/yyyy)
    const currentDate = new Date().toLocaleDateString('pt-BR');

    try {
        let numbers = [];

        // Verifica se foi fornecido um range ou números aleatórios
        if (qtdTemp1 && qtdTemp2) {
            // Processa como range
            const start = parseInt(qtdTemp1, 10);
            const end = parseInt(qtdTemp2, 10);

            if (isNaN(start) || isNaN(end) || start > end) {
                return res.status(400).json({ success: false, message: "Range inválido." });
            }

            numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        } else if (infetq2) {
            // Processa como números aleatórios separados por vírgula
            numbers = infetq2.split(',').map(num => parseInt(num.trim(), 10)).filter(num => !isNaN(num));

            if (numbers.length === 0) {
                return res.status(400).json({ success: false, message: "Números aleatórios inválidos." });
            }
        } else {
            return res.status(400).json({ success: false, message: "Nenhum range ou números aleatórios fornecidos." });
        }

        // Garante que cada número é único para evitar duplicações
        const uniqueNumbers = [...new Set(numbers)];

        // Inicializa o conteúdo ZPL consolidado
        let zplContent = "";

        // Itera pelos números únicos e adiciona cada etiqueta ao documento ZPL
        for (const num of uniqueNumbers) {
            zplContent += `^XA
                            ^CI28
                            ^CF0,40,40
                            ^FO40,40
                            ^GB720,500,3
                            ^FS^FO60,350
                            ^FDOP : ${num}
                            ^FS^FO60,420
                            ^FDDATA : ${currentDate}
                            ^FS^FO60,490
                            ^FDLINHA : ${num}
                            ^FS ^FO40,290
                            
                            ^FD____________________________________^FS
                            
                            ^CF0,60,60
                            ^FO345,60
                            ^FD${num}^FS ;Texto abaixo do QR Code
                            ^FO320,120
                            ^BQN,2,8
                            ^FDLA,${num}^FS
                            ^PQ1   
                            ^PR4
                            ^XZ\n`;
        }

        // Gera o caminho do arquivo ZPL único
        const zplFilePath = path.join(printerDir, `etiquetas_consolidadas.zpl`);

        // Salva o conteúdo ZPL consolidado no arquivo
        await fs.writeFile(zplFilePath, zplContent);

        res.json({ success: true, message: `Arquivo ZPL consolidado gerado com sucesso.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Erro ao gerar ou salvar ZPL." });
    }
});

app.post('/zpl', async (req, res) => {
    const { printerDirectory, zplData, grfData, qtdetq, infetq1, infetq2, infetq3, infetq4, infetq5, infetq6, infetq7 } = req.body; 
    const printerDir = "//172.18.1.232/" + printerDirectory.trim();

    // Atualizando o conteúdo ZPL com os novos campos
    let zplContent = zplData
        .replace(/#101@/g, infetq1)
        .replace(/#102@/g, infetq2)
        .replace(/#103@/g, infetq3)
        .replace(/#104@/g, infetq4)
        .replace(/#105@/g, infetq5)
        .replace(/#106@/g, infetq6)
        .replace(/#107@/g, infetq7);
    
    let Dta = getCurrentDate().replace(/-/g, '/');
    zplContent = zplContent.replace(/#100@/g, Dta);

    function getCurrentDate() {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${day}/${month}/${year}`;
    }

    try {
        if (grfData.trim()) {
            const grfFilePath = path.join(printerDir, 'label_template.grf');
            await fs.writeFile(grfFilePath, grfData.trim());
            console.log('Arquivo GRF criado com sucesso:', grfFilePath);
        }

        const qtdetqNum = parseInt(qtdetq.trim(), 10);
        for (let i = 0; i < qtdetqNum; i++) {
            const zplFilePath = path.join(printerDir, `label_template_${i}.zpl`);
            await fs.writeFile(zplFilePath, zplContent.trim());
            console.log('Arquivo ZPL criado com sucesso:', zplFilePath);
        }
        res.json({ success: true, message: "12" });
    } catch (error) {
        res.status(500).json({ success: false, message: "14" });
        console.error('Erro ao imprimir etiquetas:', error);
    }
});


//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 ETQ ADICIONAR 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.get('/etiqueta', async (req, res) => {
    try {
        const etiquetas = await db.getEtiquetas(); // Função para obter os dados da tabela zpl_data do banco de dados
        res.status(200).json(etiquetas); // Envie os dados obtidos como resposta
    } catch (error) {
        console.error('Erro ao buscar dados da etiqueta:', error);
        res.status(500).json({ error: 'Erro ao buscar dados da etiqueta' });
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 ETQ GRAVAR 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.post('/salvaEtq', async (req, res) => {
    const { modelo, nome, cod_etq, grf, cod_zpl, obs} = req.body;

    try {
        const result = await db.insertEtq( modelo, nome, cod_etq, grf, cod_zpl, obs);
        res.status(201).json({ message: 'ETIQUETAS adicionado com sucesso', id: result.insertId });
    } catch (error) {
        console.error('Erro ao adicionar ETIQUETAS:', error);
        res.status(500).json({ error: 'Erro ao adicionar ETIQUETAS' });
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 APF GERAR PLANILHA 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

const { gerarPlanilhaXLSX } = require('../js/db');

app.get('/export-ferr_apont-xlsx', async (req, res) => {
    try {
        const workbook = await gerarPlanilhaXLSX();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=apontamentos.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: error.message });
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 INICIAR SEVIDOR 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥
const { exec } = require('child_process');
app.use(express.static(path.join(__dirname)));

app.get('/executarPython', (req, res) => {
    exec('python ./GRF.py', (error, stderr) => {

        if (error) {
            console.error(`Erro ao executar o script Python: ${error}`);
            return res.status(500).send('Erro ao processar a imagem.');
        }

        const baseNetworkPath = './';
        const filePath = path.join(baseNetworkPath, `2345200R00.GRF`); // Construindo o caminho do arquivo
    
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
        
    });
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 SSP ADICIONAR 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.post('/gdm_setup_polimento', async (req, res) => {
    const { HRpedido, login, cc, maquina, item, operacao, lote, horario, status, calibrador, HRfinalizado, obs} = req.body;

    try {
        const result = await db.insert_setup_polimento( HRpedido, login, cc, maquina, item, operacao, lote, horario, status, calibrador, HRfinalizado, obs);
        res.status(201).json({ message: 'Setup adicionado com sucesso', id: result.insertId });
    } catch (error) {
        console.error('Erro ao adicionar Setup:', error);
        res.status(500).json({ error: 'Erro ao adicionar Setup' });
    }
});
//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 SSP SELECT 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥
app.get('/gdm_setup_polimento', async (req, res) => {
    try {
        const setups = await db.select_setup_polimento(); // Chame a função que obtém os setups do banco de dados
        res.status(200).json(setups); // Envie os setups obtidos como resposta
    } catch (error) {
        console.error('Erro ao buscar setups:', error);
        res.status(500).json({ error: 'Erro ao buscar setups' });
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 SSP ALTERAR 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.put('/gdm_setup_polimento/:id', async (req, res) => {
    const setupId = req.params.id;
    const { status } = req.body;

    try {
        const result = await db.update_setup_polimento(setupId, status);
        res.status(200).json({ message: 'Status atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar o status:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar o status.' });
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 SSP DELETAR 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥
app.delete('/gdm_setup_polimento/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const result = await db.excluir_setup_polimento(id);
        res.status(200).json({ message: 'Setup de usinagem excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir setup de usinagem:', error);
        res.status(500).json({ error: 'Erro ao excluir setup de usinagem' });
    }
});

//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 SSV ADICIONAR 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥
app.post('/zplImprimirCard', async (req, res) => {
    // Recebe os campos da etiqueta/ZPL vindos do front
    const { id, op, material, qtd_mat, data, linha, motivo, printerDirectory } = req.body;
    
    // Validação simples dos campos obrigatórios (evita gerar ZPL inválido)
    if (!op || !data|| !material|| !qtd_mat || !linha  || !printerDirectory) {
        return res.status(400).json({ success: false, message: "Campos obrigatórios ausentes." });
    }

    // OBS: aqui o diretório de impressora está fixo (135). Se quiser usar por setor, volte a usar printerDirectory.
	const printerDir = `//172.18.1.232/${printerDirectory}`;
    // const printerDir = `//172.18.1.232/135`;
    const zplFilePath = path.join(printerDir, `etiqueta_card_${op}.zpl`);

    try {
        // Monta o conteúdo ZPL (dois “cards” na mesma etiqueta)
        const zplContent = `
							^XA
                            ^CI28 
                            ^FO320,40^BQN,2,4^FDLA,${material}^FS
                            ^FO340,400^A0R,35,35^FDID: ${id}^FS  
                            ^FO260,56^A0R,35,35^FDOP: ${op}^FS       
                            ^FO220,56^A0R,35,35^FDMAT.: ${material}^FS                                                                                                                                                                                                                                               
                            ^FO180,56^A0R,35,35^FDQTD MAT: ${qtd_mat}^FS                                                                                                                                                                                                                                                                                                                     
                            ^FO140,56^A0R,35,35^FDDATA: ${data}^FS                                                                                                                                                     
                            ^FO100,56^A0R,35,35^FDLINHA:${linha}^FS                                                                                                                                                   
                            ^FO60,56^A0R,35,35^FDMOTIVO REP.:${motivo}^FS                                                                                                                                    
                            ^FO40,20^GB370,3,3^FS                                                                                                                                 
                            ^FO40,600^GB370,3,3^FS 
                            ^FO410,20^GB4,580,4^FS    
                            ^FO310,20^GB4,580,4^FS                                                                                                     
                            ^FO40,20^GB4,580,4^FS          
                            '-------------------------------------------------------------------
                            ^FO750,40^BQN,2,4^FDLA,${material}^FS
                            ^FO770,400^A0R,35,35^FDID: ${id}^FS  
                            ^FO690,56^A0R,35,35^FDOP: ${op}^FS       
                            ^FO650,56^A0R,35,35^FDMAT.: ${material}^FS                                                                                                                                                                                                                                               
                            ^FO610,56^A0R,35,35^FDQTD MAT: ${qtd_mat}^FS                                                                                                                                                                                                                                                                                                                     
                            ^FO570,56^A0R,35,35^FDDATA: ${data}^FS                                                                                                                                                     
                            ^FO530,56^A0R,35,35^FDLINHA:${linha}^FS                                                                                                                                                   
                            ^FO490,56^A0R,35,35^FDMOTIVO REP.:${motivo}^FS                                                                                                                                                                   
                            ^FO470,20^GB370,3,3^FS                                                                                                                                 
                            ^FO470,600^GB370,3,3^FS
                            ^FO840,20^GB4,580,4^FS    
                            ^FO740,20^GB4,580,4^FS                                                                                                     
                            ^FO470,20^GB4,580,4^FS                                                                                                                                                             
                            ^PQ1   
                            ^PR4    
                            ^XZ`;

        // Grava o arquivo ZPL no compartilhamento (necessita permissão de escrita no share)
        await fs.writeFile(zplFilePath, zplContent);
        res.json({ success: true, message: "Etiqueta gerada com sucesso." });

    } catch (error) {
        // Loga erro e responde 500 caso o share esteja indisponível/permissões falhem
        console.error("Erro ao gerar etiqueta:", error);
        res.status(500).json({ success: false, message: "Erro ao gerar etiqueta." });
    }
});

// Rota de histórico: retorna todas as linhas do gdm_ssv_hist para um Id
// conn.js
app.get('/gdm_ssv/:id/hist', async (req, res) => {
const { id } = req.params;
try {
    const rows = await db.get_hist_by_id(id);  // <- db.get_hist_by_id deve ordenar por data (como implementado)
    res.status(200).json(rows);
} catch (e) {
    console.error('Erro ao buscar histórico:', e);
    res.status(500).json({ error: 'Erro ao buscar histórico', detail: e.message });
}
});

// Criação de nova solicitação (aplica trava de duplicidade no db.insert_vagao)
app.post('/gdm_ssv', async (req, res) => {
const { HRpedido, login, Ctrab, op, qtd_op, material, qtd_mat, date,
        status, status_EWM, prior, HRfinalizado, motivosSSV, obs } = req.body;

// ✅ valida obrigatoriedade do motivo no servidor
if (!motivosSSV || !String(motivosSSV).trim()) {
    return res.status(400).json({
    error: 'MOTIVO_OBRIGATORIO',
    message: 'Informe o Motivo SSV.'
    });
}

try {
    const { id, duplicate } = await db.insert_vagao(
    HRpedido, login, Ctrab, op, qtd_op, material, qtd_mat, date,
    status, status_EWM, prior, HRfinalizado, motivosSSV, obs
    );

    if (duplicate) {
    return res.status(409).json({
        error: 'RESERVA_DUPLICADA',
        message: 'Reserva já solicitada para esta OP, Material e Motivo (Aguardando/ESC).'
    });
    }

    res.status(201).json({ message: 'Setup adicionado com sucesso', id });
} catch (error) {
    console.error('Erro ao adicionar Setup:', error);
    res.status(500).json({ error: 'Erro ao adicionar Setup', detalhe: error.message });
}
});

// Lista todos os registros (para o monitor)
app.get('/gdm_ssv', async (req, res) => {
    try {
        const setups = await db.select_vagao();
        res.status(200).json(setups);
    } catch (error) {
        console.error('Erro ao buscar setups:', error);
        res.status(500).json({ error: 'Erro ao buscar setups' });
    }
});

// Atualiza status "motivo" (ESC/GER/MONTAGEM/ROTA/Finalizado) por Id
app.put('/gdm_ssv/:id', async (req, res) => {
    const setupId = req.params.id;
    const { status } = req.body;
    const { HRfinalizado } = req.body;

    try {
        const result = await db.update_vagao(setupId, status, HRfinalizado); // <- db.update_vagao deve aplicar efeitos colaterais (horarios + hist)
        res.status(200).json({ message: 'Status atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar o status:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar o status.' });
    }
});

// Atualiza status_EWM (Aguardando/Preparando/Coletado/Divergente/Cancelado/Rota/Finalizado)
app.put('/gdm_ssv_ewm/:id', async (req, res) => {
    const { id } = req.params;
    const { status_EWM } = req.body;

    try {
        const result = await db.update_vagao_ewm(id, status_EWM); // <- idem: efeitos colaterais + hist no DB
        res.status(200).json({ message: 'Status EWM atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar status_EWM:', error);
        res.status(500).json({ error: 'Erro ao atualizar status_EWM' });
    }
});

// Atualiza observação do registro
app.put('/gdm_ssv_obs/:id', async (req, res) => {
    const setupId = req.params.id;
    const { obs } = req.body;
    const { status } = req.body; // <- se o db.update_vagao_obs não usa "status", ok (parâmetro extra é ignorado)

    try {
        const result = await db.update_vagao_obs(setupId, obs, status); // <- alinhar assinatura no db.js (2 ou 3 args)
        res.status(200).json({ message: 'Status atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar o status:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar o status.' });
    }
});

// Exclui o registro por Id
app.delete('/gdm_ssv/:id', async (req, res) => {
    const id = req.params.id;

    try {
        const result = await db.excluir_vagao(id);
        res.status(200).json({ message: 'Setup de usinagem excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir setup de usinagem:', error);
        res.status(500).json({ error: 'Erro ao excluir setup de usinagem' });
    }
});


// Exportação para XLSX (usa gerarPlanilhaXLSX_SSV do db)
const { gerarPlanilhaXLSX_SSV } = require('../js/db');

app.get('/export-ssv-xlsx', async (req, res) => {
    try {
        const { start, end } = req.query; // 'YYYY-MM-DD'
        const wb = await gerarPlanilhaXLSX_SSV(start, end);
        res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition',`attachment; filename=ssv_export_${start || 'all'}_a_${end || 'all'}.xlsx`);
        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Gráfico de SSV por dia (contagem diária entre datas)
const { graficoSSV } = require('../js/db');

app.get('/grafico-ssv/:tipo', async (req, res) => {
    try {
        const { tipo } = req.params;
        const { start, end } = req.query;

        const dados = await graficoSSV(tipo, start, end);
        res.json(dados);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});














// ==================================================================================================
// 🚥 CAL - CADASTRAR NOVO CALIBRADOR
// ==================================================================================================
app.post('/gdm_cal', async (req, res) => {
    const { centro, Codi, grupo, tipo, Descricao, status, Controlado, localizacao, frequencia, ultiCalibr, numeCertif, Obs } = req.body;

    try {
        // 1. Verifica se já existe o código
        const existente = await db.getCalibradorPorCodigo(Codi);
        if (existente) {
            return res.status(409).json({ error: 'Já existe calibrador com este código.' });
        }

        // 2. Insere novo
        const result = await db.insertCal(centro, Codi, grupo, tipo, Descricao, status, Controlado, localizacao, frequencia, ultiCalibr, numeCertif, Obs);
        res.status(201).json({ message: 'Calibrador cadastrado com sucesso.', id: result.insertId });
    } catch (error) {
        console.error('Erro ao cadastrar calibrador:', error);
        res.status(500).json({ error: 'Erro interno ao cadastrar calibrador.' });
    }
});

// ==================================================================================================
// 🚥 CAL - SELECT - Buscar movimentações de calibrador específico
// ==================================================================================================
app.get('/gdm_cal_mov/:codigo', async (req, res) => {
    let { codigo } = req.params;
    const { grupo } = req.query;

    if (!grupo) {
        return res.status(400).json({ error: "Grupo é obrigatório." });
    }

    try {
        const match = codigo.match(/CAL-(\d+)-\d+/i);
        if (match) codigo = match[1];

        const movimentacoes = await db.get_movimentacoes_calibrador(codigo, grupo);

        if (!movimentacoes || movimentacoes.length === 0) {
            return res.status(404).json({ error: 'Nenhuma movimentação encontrada' });
        }

        res.json(movimentacoes);

    } catch (error) {
        console.error('Erro ao consultar movimentações:', error);
        res.status(500).json({ error: 'Erro ao consultar movimentações.' });
    }
});

// ==================================================================================================
// 🚦 BLOQUEAR FERRAMENTA (coloca Bloq = 1)
// ==================================================================================================
const { alterarBloqueioFerramenta } = require('../js/db');

app.put('/ferramenta-bloqueio/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { grupo, statusBloqueio } = req.body;

        if (!grupo) return res.status(400).json({ error: "Grupo é obrigatório." });
        if (statusBloqueio !== '0' && statusBloqueio !== '1')
            return res.status(400).json({ error: "Status deve ser '0' ou '1'." });

        await alterarBloqueioFerramenta(id, grupo, statusBloqueio);

        const msg = statusBloqueio === '1' ? 'bloqueada' : 'desbloqueada';
        res.status(200).json({ message: `Ferramenta ${id} ${msg} com sucesso.` });

    } catch (err) {
        console.error('Erro ao alterar bloqueio:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==================================================================================================
// 🚥 CAL - SELECT - Buscar calibrador pelo código
// ==================================================================================================
app.get('/gdm_cal/:codi', async (req, res) => {
    const { codi } = req.params;
    const { grupo } = req.query;

    try {
        const calibrador = await db.getCalibradorPorCodigo(codi, grupo);
        if (!calibrador) {
            return res.status(404).json({ error: 'Calibrador não encontrado' });
        }
        res.json(calibrador);
    } catch (error) {
        console.error('Erro ao buscar calibrador:', error);
        res.status(500).json({ error: 'Erro interno ao buscar calibrador' });
    }
});

// ==================================================================================================
// 📋 LISTAR CALIBRADORES (com filtros opcionais e colunas completas)
// ==================================================================================================
app.get('/gdm_cal', async (req, res) => {
    const { grupo,  tipo, codigo, descricao, localizacao } = req.query;
    try {
        let query = `
            SELECT 
                centro, 
                grupo,
                tipo,
                Codi,
                Descricao,
                localizacao,
                status,
                frequencia,
                ultiCalibr,
                numeCertif,
                versaoCertif
            FROM gdm_cal
            WHERE 1=1
        `;

        if (grupo) query += ` AND grupo = '${grupo}'`;
        if (tipo) query += ` AND tipo LIKE '%${tipo}%'`;
        if (codigo) query += ` AND Codi LIKE '%${codigo}%'`;
        if (descricao) query += ` AND Descricao LIKE '%${descricao}%'`;
        if (localizacao) query += ` AND localizacao LIKE '%${localizacao}%'`;

        const pool = await db.getConnection();
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('Erro ao listar calibradores:', error);
        res.status(500).json({ error: 'Erro ao listar calibradores.' });
    }
});

// ==================================================================================================
// 🚥 CAL - Abrir foto do calibrador 🚥
// ==================================================================================================
app.get('/fotoabrir/:codi', async (req, res) => {

    const codiOriginal = req.params.codi?.trim();

    if (!codiOriginal) return res.status(400).send('Código inválido');

    // Remove zeros à esquerda para tentar variações (ex: 0002 -> 2)
    const codiSemZeros = codiOriginal.replace(/^0+/, '');

    const baseNetworkPath = '\\\\syrius\\Processos_DIII\\Processo_Usinagem\\Gerenciador Centros de Usinagem\\Dados\\Troca Rápida\\Banco_002\\Banco_Ferramentas\\Foto Calibrador';
    const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    let filePath = null;

    // tenta com e sem zeros
    const codigosPossiveis = [codiOriginal, codiSemZeros];

    for (const codigo of codigosPossiveis) {
        for (const ext of exts) {
            const tentativa = path.join(baseNetworkPath, `${codigo}${ext}`);
            try {
                await fs1.promises.access(tentativa, fs1.constants.F_OK);
                filePath = tentativa;
                break;
            } catch {
                // continua tentando
            }
        }
        if (filePath) break;
    }

    if (!filePath) {
        return res.status(404).send('Foto não encontrada');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);

    fs1.createReadStream(filePath).pipe(res);
});
// ==================================================================================================
// 🚥 CAL - ABRIR CERTIFICADO DE CALIBRAÇÃO (PDF)
// ==================================================================================================
app.get('/certificadoabrir/:arquivo', async (req, res) => {

    const arquivoOriginal = req.params.arquivo?.trim();

    if (!arquivoOriginal) return res.status(400).send('Nome de arquivo inválido');

    // Remove zeros à esquerda no código
    const arquivoSemZeros = arquivoOriginal.replace(/^0+/, '');

    // Caminho base
    const baseNetworkPath = '\\\\syrius\\Processos_DIII\\Processo_Usinagem\\Gerenciador Centros de Usinagem\\Dados\\Troca Rápida\\Banco_002\\Banco_Ferramentas\\Certificado';
    const exts = ['.pdf']; // agora só PDF

    let filePath = null;
    const tentativas = [arquivoOriginal, arquivoSemZeros];

    for (const nome of tentativas) {
        for (const ext of exts) {
            const tentativa = path.join(baseNetworkPath, `${nome}${ext}`);
            try {
                await fs1.promises.access(tentativa, fs1.constants.F_OK);
                filePath = tentativa;
                break;
            } catch {
                // continua tentando
            }
        }
        if (filePath) break;
    }

    if (!filePath) {
        return res.status(404).send('Certificado não encontrado');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
    fs1.createReadStream(filePath).pipe(res);
});

// ==================================================================================================
// 🚥 CAL - ALTERAR DADOS DO CALIBRADOR
// ==================================================================================================
app.put('/gdm_cal/update/:id', async (req, res) => {

    const codi = req.params.id;
    const dados = req.body || {}; // <<<<<<<< PREVINE undefined

    console.log("🔥 ROUTE UPDATE RECEBIDO:", dados);

    try {
        await db.updateCalibrador(codi, dados);
        res.status(200).json({ message: 'Calibrador atualizado com sucesso.' });

    } catch (err) {
        console.error('Erro ao atualizar calibrador:', err);
        res.status(500).json({ error: 'Erro interno ao atualizar calibrador.' });
    }
});

// ==================================================================================================
// 🚥 CAL - DELETAR
// ==================================================================================================
app.delete('/gdm_cal/:id', async (req, res) => {
    const id = req.params.id;

    try {
        await db.deleteCal(id);
        res.status(200).json({ message: 'Calibrador excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir calibrador:', error);
        res.status(500).json({ error: 'Erro ao excluir calibrador' });
    }
});

// ==================================================================================================
// 🚥 CAL - EXPORTAR PARA PLANILHA COM FILTROS
// ==================================================================================================
const { gerarPlanilhaXLSX_CALIB } = require('../js/db');

app.get('/export-calibradores-xlsx', async (req, res) => {
    try {
        const { tipo, codigo, status, descricao, localizacao, grupo } = req.query;

        const wb = await gerarPlanilhaXLSX_CALIB({
            tipo, codigo, status, descricao, localizacao, grupo
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=calibradores_filtrados.xlsx');

        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Erro na exportação XLSX:', err);
        res.status(500).json({ error: err.message });
    }
});




//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 EWM 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥
// Função para buscar dados da tabela gdm_tabela_zrpp008

app.get('/select_ZRPP008', async (req, res) => {
    try {
        const setups = await db.select_ZRPP008(); // Chame a função que obtém os setups do banco de dados
        res.status(200).json(setups); // Envie os setups obtidos como resposta
    } catch (error) {
        console.error('Erro ao buscar dados zrpp008:', error);
        res.status(500).json({ error: 'Erro ao buscar  dados zrpp008' });
    }
});

app.get('/select_ZRPP013', async (req, res) => {
    try {
        const setups = await db.select_ZRPP013(); // Chame a função que obtém os setups do banco de dados
        res.status(200).json(setups); // Envie os setups obtidos como resposta
    } catch (error) {
        console.error('Erro ao buscar dados zrpp013:', error);
        res.status(500).json({ error: 'Erro ao buscar  dados zrpp013' });
    }
});

app.get('/select_EWM1', async (req, res) => {
    try {
        const setups = await db.select_EWM1(); // Chame a função que obtém os setups do banco de dados
        res.status(200).json(setups); // Envie os setups obtidos como resposta
    } catch (error) {
        console.error('Erro ao buscar dados zrpp:', error);
        res.status(500).json({ error: 'Erro ao buscar  dados zrpp' });
    }
});

// ==================================================================================================
// 🚥 TI - EQUIPAMENTOS
// ==================================================================================================
// LISTAR TODOS
    app.get('/gdm_eqpti/listar', async (req, res) => {
    try {
        const dados = await listarEquipamentos();
        res.json(dados);
    } catch (err) {
        console.error('Erro listar:', err);
        res.status(500).json({ erro: 'Erro ao listar equipamentos' });
    }
    });

    // INSERIR NOVO
    app.post('/gdm_eqpti/novo', async (req, res) => {
    try {
        await inserirEquipamento(req.body);
        res.status(201).json({ ok: true });
    } catch (err) {
        console.error('Erro inserir:', err);
        res.status(500).json({ erro: 'Erro ao inserir equipamento' });
    }
    });

    // ATUALIZAR STATUS / FORNECEDOR
    app.put('/gdm_eqpti/status/:id', async (req, res) => {
    try {
        await atualizarEquipamento(req.params.id, req.body);
        res.json({ ok: true });
    } catch (err) {
        console.error('Erro atualizar:', err);
        res.status(500).json({ erro: 'Erro ao atualizar equipamento' });
    }
    });




// ==================================================================================================
// 🚥 ROTINA DOS FACILITADORES - ALTERAR PARADAS
// ==================================================================================================
// =======================================================================
// 🚥 PARADAS – ALTERAR STATUS/FIM/TEMPO
// =======================================================================
app.put('/gdm_paradas/:centro_trabalho', async (req, res) => {
    const { centro_trabalho } = req.params;
    const { inicio, status_parada, Obs, status } = req.body;

    try {
        await db.update_monitor_parada(centro_trabalho, inicio, status_parada, Obs, status);
        res.status(200).json({ message: "Parada atualizada com sucesso." });
    } catch (error) {
        console.error("Erro ao atualizar parada:", error);
        res.status(500).json({ error: "Erro ao atualizar parada." });
    }
});


// =======================================================================
// 🚥 ROTINA DOS FACILITADORES – BUSCAR STATUS DAS PARADAS
// =======================================================================
app.get('/gdm_paradas/status', async (req, res) => {
    try {
        const setups = await db.select_gdm_monitor_paradas();
        const mapa = {};

        setups.forEach(row => {
            const ct = row.centro_trabalho;

            if (!mapa[ct]) {
                mapa[ct] = {
                    status: "Em Produção",
                    motivos: [],
                    gargalo: row.Gargalo || "NÃO",
                    inicio: row.inicio || null,
                    status_palete: row.Status || null,
                    obs: row.Obs || null
                };
            }

            if (row.status_parada && row.status_parada !== "") {
                mapa[ct].status = row.status_parada;
                mapa[ct].motivos.push(row.status_parada);
            }

            mapa[ct].inicio = row.inicio || mapa[ct].inicio;
            mapa[ct].obs = row.Obs || mapa[ct].obs;
            mapa[ct].status_palete = row.Status || mapa[ct].status_palete;
        });

        res.status(200).json(mapa);
    } catch (error) {
        console.error('Erro ao buscar dados gdm_monitor_paradas:', error);
        res.status(500).json({ error: 'Erro ao buscar dados gdm_monitor_paradas' });
    }
});
// =======================================================================
// 🚥 ROTINA DOS FACILITADORES – BUSCAR PRODUÇÃO CT
// =======================================================================
app.get("/producao_ct", async (req, res) => {
    try {
        const dados = await db.select_producao_ct();

        const mapa = {};
        dados.forEach(row => {
            mapa[row.Centro_Trabalho] = {
                Performance_Linha: row.Performance_Linha,
                T1: row.T1,
                T2: row.T2,
                T3: row.T3,
                T4: row.T4,
                Total_T: row.Total_T,
                OP_Em_Producao: row.OP_Em_Producao,
                Acabamento: row.Acabamento,
                Qualidade: row.Qualidade,
                Try_Out: row.Try_Out,
                Material: row.Material,
                Descricao: row.Descricao,
                Data_Ult_Apont: row.Data_Ult_Apont,
                Hora_Ult_Apont: row.Hora_Ult_Apont,
                Dias_sem_Apont: row.Dias_sem_Apont,
                Horas_sem_Apont: row.Horas_sem_Apont,
                Prod_Meta: row.Prod_Meta,
                Prod_Acumulada: row.Prod_Acumulada,
                Prod_Perc: row.Prod_Perc,
                OP_Convertida_Pcs: row.OP_Convertida_Pcs,
                OP_Convertida_Dia: row.OP_Convertida_Dia,
                OP_Liberada_Pcs: row.OP_Liberada_Pcs,
                OP_Liberada_Dia: row.OP_Liberada_Dia,
                Nao_Entrou_EWM_Pcs: row.Nao_Entrou_EWM_Pcs,
                Nao_Entrou_EWM_Dia: row.Nao_Entrou_EWM_Dia,
                OP_Preparacao_Dia: row.OP_Preparacao_Dia,
                Vagao_Completo_Dia: row.Vagao_Completo_Dia,
                Status: row.Status,
                Status_Apontamento: row.Status_Apontamento
            };
        });
        res.json(mapa);
    } catch (e) {
        console.error("Erro produção CT:", e);
        res.status(500).json({ error: "Erro carga produção CT" });
    }
});




















//__________________________________________________________________________________________________________
//🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥 PORTA 🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥🚥

app.use('/GDM', express.static(path.join(__dirname, 'GDM')));


app.listen(port, () => {
    console.log(`API funcionando na porta ${port}`);
});
