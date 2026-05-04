    /**
     * =============================================================================
     * DEPENDÊNCIAS E CONFIGURAÇÃO
     * =============================================================================
     */
    const sql = require('mssql');
    const ExcelJS = require('exceljs'); // usado em exportações XLSX
    const fs = require('fs');           // usado em fluxos de arquivo

    // Config do SQL Server via variáveis de ambiente (mantido)
    const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true,
    },
    pool: {
        max: 70,
        min: 2,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
    };

    /**
     * =============================================================================
     * POOL GLOBAL + HEALTH LOG
     * =============================================================================
     * Pool único reaproveitado por toda a aplicação
     * (mantém o comportamento, apenas comentários e logs)
     */
    let pool;

    // Log simples de saúde do pool a cada 10s (não interfere na lógica)
    setInterval(() => {
    if (pool && pool.connected && pool.pool) {
        try {
        console.log({
            dbPool: {
            connected: pool.connected,
            used: pool.pool.numUsed(),
            free: pool.pool.numFree(),
            pendingAcquires: pool.pool.numPendingAcquires(),
            pendingCreates: pool.pool.numPendingCreates(),
            max: config.pool.max,
            min: config.pool.min,
            }
        });
        } catch (error) {
        console.error('Erro ao acessar informações do pool:', error.message);
        }
    } else {
        console.log('Nenhuma conexão ativa.');
    }
    }, 10000);

    /**
     * =============================================================================
     * HELPERS DE CONEXÃO
     * =============================================================================
     */

    // Obtém (ou cria) o pool de conexões
    async function getConnection() {
    if (pool && pool.connected) return pool;
    if (!pool) {
        pool = new sql.ConnectionPool(config);
        pool = await pool.connect();
        console.log('Conexão pool estabelecida.');
    }
    return pool;
    }

    // Fecha explicitamente o pool (para shutdown/rotate controlado)
    async function closeConnection() {
    if (pool) {
        await pool.close();
        pool = null;
        console.log('Pool de conexões fechado.');
    }
    }

    // Utilitário genérico para executar query com parâmetros
    async function executeQuery(query, params = []) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        params.forEach((p) => request.input(p.name, p.type, p.value));
        const result = await request.query(query);
        return result.recordset;
    } catch (err) {
        console.error('Erro ao executar consulta:', err);
        throw err;
    }
    }

    // Teste rápido de conexão (mantido do seu código)
    async function testConnection() {
    let localPool;
    try {
        localPool = await sql.connect(config);
        console.log('Conexão com o banco de dados estabelecida com sucesso.');
    } catch (err) {
        console.error('Erro ao conectar com o banco de dados:', err);
    } finally {
        if (localPool) {
        try {
            await localPool.close();
            console.log('Conexão com o banco de dados fechada com sucesso.');
        } catch (err) {
            console.error('Erro ao fechar a conexão com o banco de dados:', err);
        }
        }
    }
    }
    testConnection();

    /**
     * =============================================================================
     * CMG – CARGA MÁQUINA (IMPORTAÇÃO CSV)
     * =============================================================================
     */

    // Insere dados em lotes (mantido; usa string literal conforme original)
    async function insertCSVData(data) {
    const batchSize = 100;
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        console.log('Transação iniciada.');

        // Limpa a tabela de destino (mantido)
        await transaction.request().query('DELETE FROM dbo.gdm_carga_maq_sap');

        // Insere por lotes (mantido)
        for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const values = batch.map((item) => `(
            ${item.Centro_de_custo ? `'${item.Centro_de_custo}'` : 'NULL'},
            ${item.Descricao_Centro_de_Custo ? `'${item.Descricao_Centro_de_Custo}'` : 'NULL'},
            ${item.Centro ? `'${item.Centro}'` : 'NULL'},
            ${item.Centro_de_trabalho ? `'${item.Centro_de_trabalho}'` : 'NULL'},
            ${item.Descricao_Centro_de_Trabalho ? `'${item.Descricao_Centro_de_Trabalho}'` : 'NULL'},
            ${item.Gestor_do_CC ? `'${item.Gestor_do_CC}'` : 'NULL'},
            ${item.Periodo ? `'${item.Periodo}'` : 'NULL'},
            ${item.Dias_Uteis ? `'${item.Dias_Uteis}'` : 'NULL'},
            ${item.Horas_Disponiveis ? `'${item.Horas_Disponiveis}'` : 'NULL'},
            ${item.Horas_de_Ocupacao ? `'${item.Horas_de_Ocupacao}'` : 'NULL'},
            ${item.Horas_de_Ocupacao_OEE ? `'${item.Horas_de_Ocupacao_OEE}'` : 'NULL'},
            ${item.Percentual_de_OEE ? `'${item.Percentual_de_OEE}'` : 'NULL'},
            ${item.Quantidade_de_Maquinas ? `'${item.Quantidade_de_Maquinas}'` : 'NULL'},
            ${item.T1 ? `'${item.T1}'` : 'NULL'},
            ${item.T2 ? `'${item.T2}'` : 'NULL'},
            ${item.T3 ? `'${item.T3}'` : 'NULL'},
            ${item.Revezamento ? `'${item.Revezamento}'` : 'NULL'},
            ${item.Horas_Tryout ? `'${item.Horas_Tryout}'` : 'NULL'},
            ${item.Horas_Preventiva ? `'${item.Horas_Preventiva}'` : 'NULL'},
            ${item.Porcentagem ? `'${item.Porcentagem}'` : 'NULL'}
        )`).join(',');

        const query = `
            INSERT INTO dbo.gdm_carga_maq_sap (
            Centro_de_custo, Descricao_Centro_de_Custo, Centro, Centro_de_trabalho, 
            Descricao_Centro_de_Trabalho, Gestor_do_CC, Periodo, Dias_Uteis, 
            Horas_Disponiveis, Horas_de_Ocupacao, Horas_de_Ocupacao_OEE, 
            Percentual_de_OEE, Quantidade_de_Maquinas, T1, T2, T3, Revezamento, 
            Horas_Tryout, Horas_Preventiva, Porcentagem
            ) VALUES ${values}
        `;

        try {
            await transaction.request().query(query);
        } catch (batchError) {
            console.error('Erro ao inserir dados no lote:', batchError);
        }
        }

        await transaction.commit();
        console.log('Dados inseridos com sucesso.');
    } catch (error) {
        console.error('Erro ao inserir dados:', error);
        try {
        await transaction.rollback();
        console.log('Transação revertida.');
        } catch (rollbackError) {
        console.error('Erro ao reverter a transação:', rollbackError);
        }
        throw error;
    }
    }

    // Seleção para front (mantido)
    async function select_cargaMaq() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM gdm_carga_maq_sap`;

        return result.recordset.map((record) => ({
        centroDeCusto: record.Centro_de_custo,
        descriDeCusto: record.Descricao_Centro_de_Custo,
        centroDeTrabalho: record.Centro_de_trabalho,
        gestorDoCC: record.Gestor_do_CC,
        periodo: record.Periodo,
        cor: record.Porcentagem,
        valor: parseFloat(record.Porcentagem),
        qtdMaq: record.Quantidade_de_Maquinas,
        t1: record.T1,
        t2: record.T2,
        t3: record.T3,
        revezamento: record.Revezamento,
        }));
    } catch (error) {
        throw error;
    }
    }

    /**
     * =============================================================================
     * LOGIN – CONSULTA DE CREDENCIAIS
     * =============================================================================
     */
    async function selectLogin(username, password) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        SELECT * FROM gdm_login 
        WHERE username = ${username} AND password = ${password}
        `;
        return result.recordset;
    } catch (error) {
        throw error;
    }
    }

    /**
     * =============================================================================
     * CAD – CADASTRO DE USUÁRIO (CRUD + VERIFICAÇÕES)
     * =============================================================================
     */

    // Verifica existência por username (para insert idempotente)
    async function usernameExists(username) {
    const pool = await getConnection();
    const request = pool.request();
    const result = await request.query`
        SELECT 1 AS ok FROM dbo.gdm_login WHERE username = ${username}
    `;
    return result.recordset.length > 0;
    }

    // Lista todos (grid)
    async function select_CAD() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM gdm_login`;
        return result.recordset;
    } catch (error) {
        console.error('Erro ao conectar ao banco de dados:', error);
        throw error;
    }
    }

    // Busca 1 por Id (edição)
    async function getUserById(id) {
    const pool = await getConnection();
    const request = pool.request();
    request.input('id', sql.Int, Number(id));
    const r = await request.query(`
        SELECT TOP 1 * 
        FROM dbo.gdm_login
        WHERE Id = @id
    `);
    return r.recordset[0] || null;
    }

    // Retorna somente o username do Id (comparação de mudança)
    async function getUsernameById(id) {
    const pool = await getConnection();
    const r = await pool.request()
        .input('id', sql.Int, Number(id))
        .query(`SELECT TOP 1 username FROM dbo.gdm_login WHERE Id = @id`);
    return r.recordset[0]?.username ?? null;
    }

    // Verifica duplicidade para OUTRO Id (update)
    async function usernameExistsForOtherId(username, id) {
    const pool = await getConnection();
    const request = pool.request();
    request.input('username', sql.NVarChar, username.trim());
    request.input('id', sql.Int, Number(id));

    // Mantido com collation específico (mantém comportamento)
    const q = `
        SELECT 1 AS ok
        FROM dbo.gdm_login
        WHERE RTRIM(LTRIM(username)) COLLATE Latin1_General_CI_AI =
            RTRIM(LTRIM(@username)) COLLATE Latin1_General_CI_AI
        AND Id <> @id
    `;
    const r = await request.query(q);
    return r.recordset.length > 0;
    }

    // INSERT (parametrizado; mantém regra idempotente e retorno)
    async function insert_CAD(username, password, nome, auth, cad, prof, email, acess, obs) {
    try {
        const pool = await getConnection();
        const request = pool.request();

        const normUsername = (username || '').trim();

        const exists = await usernameExists(normUsername);
        if (exists) {
        const err = new Error('USERNAME_ALREADY_EXISTS');
        err.code = 'USERNAME_ALREADY_EXISTS';
        throw err;
        }

        const result = await request
        .input('username', sql.NVarChar, normUsername)
        .input('password', sql.NVarChar, password)
        .input('nome',     sql.NVarChar, nome)
        .input('auth',     sql.NVarChar, auth)
        .input('cad',      sql.NVarChar, cad)
        .input('prof',     sql.NVarChar, prof)
        .input('email',    sql.NVarChar, email)
        .input('acess',    sql.NVarChar, acess)
        .input('obs',      sql.NVarChar, obs)
        .query(`
            INSERT INTO dbo.gdm_login (username, password, Nome, auth, cad, prof, email, acess, obs)
            VALUES (@username, @password, @nome, @auth, @cad, @prof, @email, @acess, @obs);
            SELECT SCOPE_IDENTITY() AS insertId;
        `);

        return { insertId: result.recordset?.[0]?.insertId };
    } catch (error) {
        // 2627/2601 = UNIQUE
        if (error.number === 2627 || error.number === 2601) {
        const e = new Error('USERNAME_ALREADY_EXISTS');
        e.code = 'USERNAME_ALREADY_EXISTS';
        throw e;
        }
        throw error;
    }
    }

    // UPDATE (checa duplicidade só se username mudou; mantém lógica)
    async function update_CAD({ id, username, password, nome, auth, cad, prof, email, acess, obs }) {
    const pool = await getConnection();

    const normUsername = String(username ?? '').trim();

    const currentUsername = await getUsernameById(id);
    const currentNorm = String(currentUsername ?? '').trim();

    const changed = currentNorm !== normUsername;
    if (changed) {
        const dup = await usernameExistsForOtherId(normUsername, id);
        if (dup) {
        const e = new Error('USERNAME_ALREADY_EXISTS');
        e.code = 'USERNAME_ALREADY_EXISTS';
        throw e;
        }
    }

    // Senha só atualiza se vier preenchida (mantido)
    const setPassword = Boolean(password && String(password).trim() !== '');

    const q = `
        UPDATE dbo.gdm_login
        SET username = @username,
            ${setPassword ? 'password = @password,' : ''}
            Nome = @nome,
            auth = @auth,
            cad = @cad,
            prof = @prof,
            email = @email,
            acess = @acess,
            obs = @obs
        WHERE Id = @id;

        SELECT @id AS Id;
    `;

    const req = pool.request()
        .input('id',       sql.Int, Number(id))
        .input('username', sql.NVarChar, normUsername)
        .input('nome',     sql.NVarChar, String(nome ?? ''))
        .input('auth',     sql.NVarChar, String(auth ?? ''))
        .input('cad',      sql.NVarChar, String(cad ?? ''))
        .input('prof',     sql.NVarChar, String(prof ?? ''))
        .input('email',    sql.NVarChar, String(email ?? ''))
        .input('acess',    sql.NVarChar, String(acess ?? ''))
        .input('obs',      sql.NVarChar, String(obs ?? ''));
    if (setPassword) req.input('password', sql.NVarChar, String(password));

    const r = await req.query(q);
    return r.recordset?.[0] ?? { Id: id };
    }

    /**
     * =============================================================================
     * APF
     * =============================================================================
     * (Mantidos exatamente como estavam)
     */
    async function insertferr_apont(login, n_op, n_ope, n_user, n_tur, trab_real, uni_trab, conf_final, data_lanc, data_ini, hora_ini, data_fim, hora_fim, status, obs) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        INSERT INTO gdm_ferra_apont ( login, n_op, n_ope, n_user, n_tur, trab_real, uni_trab, conf_final, data_lanc, data_ini, hora_ini, data_fim, hora_fim, status, obs) 
        VALUES (${login}, ${n_op}, ${n_ope}, ${n_user}, ${n_tur}, ${trab_real}, ${uni_trab}, ${conf_final}, ${data_lanc}, ${data_ini}, ${hora_ini}, ${data_fim}, ${hora_fim}, ${status}, ${obs})
        `;
        return result;
    } catch (error) { throw error; }
    }
    async function selectferr_apont() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM gdm_ferra_apont`;
        return result.recordset;
    } catch (error) { throw error; }
    }
    async function update_ferr_apont(id, trab_real, conf_final, data_fim, hora_fim, status, obs) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        UPDATE gdm_ferra_apont 
            SET trab_real = ${trab_real}, conf_final = ${conf_final}, data_fim = ${data_fim}, hora_fim = ${hora_fim}, status = ${status}, obs = ${obs} 
        WHERE Id = ${id}
        `;
        return result;
    } catch (error) { throw error; }
    }

    /**
     * =============================================================================
     * SSU
     * =============================================================================
     */
    async function insertCustomer(HRpedido, login, cc, maquina, item, operacao, lote, horario, status, calibrador, HRfinalizado, obs) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        INSERT INTO setupusi (HRpedido, login, cc, maquina, item, operacao, lote, horario, status, calibrador, HRfinalizado, obs) 
        VALUES (${HRpedido}, ${login}, ${cc}, ${maquina}, ${item}, ${operacao}, ${lote}, ${horario}, ${status}, ${calibrador}, ${HRfinalizado}, ${obs})
        `;
        return result;
    } catch (error) { throw error; }
    }
    async function selectCustomers() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM setupusi`;
        return result.recordset;
    } catch (error) { throw error; }
    }
    async function updateStatus(id, novoStatus) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        UPDATE setupusi SET status = ${novoStatus} WHERE Id = ${id}
        `;
        return result;
    } catch (error) { throw error; }
    }
    async function excluirSetupUsiPorId(id) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        DELETE FROM setupusi WHERE id = ${id}
        `;
        return result;
    } catch (error) { throw error; }
    }

    /**
     * =============================================================================
     * SSU FIP
     * =============================================================================
     */
    async function getItemByFipN(id) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM SMP_FIP WHERE Item = ${id}`;
        return result.recordset;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
    }

    /**
     * =============================================================================
     * FOLHA DE PROCESSO
     * =============================================================================
     */
    async function getFolhaProcessoItem(item) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT Docu FROM ferramentaria_x_item WHERE Item = ${item}`;
        return result.recordset;
    } catch (error) { throw error; }
    }

    /**
     * =============================================================================
     * GRUPO DE MÁQUINAS
     * =============================================================================
     */
    async function getMaquinasPorCentroCusto(centroCusto) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        SELECT Maquina FROM rotina_faci_status_maquina WHERE C_C = ${centroCusto}
        `;
        return result.recordset;
    } catch (error) { throw error; }
    }

    /**
     * =============================================================================
     * ETQ
     * =============================================================================
     */
    async function getEtiquetas() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM zpl_data`;
        return result.recordset;
    } catch (error) { throw error; }
    }
    async function insertEtq(modelo, nome, cod_etq, grf, cod_zpl, obs) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        INSERT INTO zpl_data (modelo, nome, cod_etq, grf, cod_zpl, obs) 
        VALUES (${modelo}, ${nome}, ${cod_etq}, ${grf}, ${cod_zpl}, ${obs})
        `;
    return result;
    } catch (error) { throw error; }
    }
    async function buscarEtiquetaPorId(id) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM zpl_data WHERE id = ${id}`;
        return result.recordset;
    } catch (error) {
        console.error('Erro na consulta ao banco de dados:', error);
        throw error;
    }
    }

    /**
     * =============================================================================
     * EXPORTAR EXCEL APF
     * =============================================================================
     */
    async function gerarPlanilhaXLSX() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM gdm_ferra_apont WHERE status = 'Finalizado'`;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data');

        worksheet.columns = [
        { header: 'Nº da ordem', key: 'n_op', width: 10 },
        { header: 'Descrição da ordem', key: '----', width: 10 },
        { header: 'Operação', key: 'n_ope', width: 10 },
        { header: 'Descrição da operação', key: '----', width: 10 },
        { header: 'Suboperação', key: '----', width: 10 },
        { header: 'Empregado', key: 'n_user', width: 10 },
        { header: 'Tipo de atividade', key: '----', width: 10 },
        { header: 'Trabalho real', key: 'trab_real', width: 15 },
        { header: 'Unidade de trabalho', key: 'uni_trab', width: 15 },
        { header: 'Confirmação final (X=Sim, Nulo=Não)', key: 'conf_final', width: 15 },
        { header: 'Data de lançamento', key: 'data_lanc', width: 15 },
        { header: 'Texto de confirmação', key: '----', width: 10 },
        { header: 'Data do início', key: 'data_ini', width: 15 },
        { header: 'Hora de início (HH:MM:SS)', key: 'hora_ini', width: 10 },
        { header: 'Data do fim', key: 'data_fim', width: 15 },
        { header: 'Hora de fim (HH:MM:SS)', key: 'hora_fim', width: 10 },
        { header: 'Data fim previsão', key: '----', width: 20 },
        { header: 'Hora de fim de previsão (HH:MM:SS)', key: '----', width: 20 },
        { header: 'Nenhum trabalho restante previsto (X=Sim, Nulo=Não)', key: '----', width: 20 },
        { header: 'Trabalho restante', key: '----', width: 20 },
        { header: 'Unidade de medida para trabalho restante', key: '----', width: 20 },
        { header: 'Compensar reservas pendentes (X=Sim, Nulo=Não)', key: '----', width: 20 },
        { header: 'Motivo para desvio', key: '----', width: 20 },
        ];

        // Estilo cabeçalho (mantido)
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern:'solid', fgColor:{ argb:'616366' } };
        cell.font = { bold: true, color: { argb: '00A9E0' }, size: 10 };
        cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        });

        // Formatação de data (mantido)
        result.recordset.forEach(record => {
        if (record.data_ini)  record.data_ini  = record.data_ini.replace(/(\d{4})-(\d{2})-(\d{2})/, '$2/$3/$1');
        if (record.data_fim)  record.data_fim  = record.data_fim.replace(/(\d{4})-(\d{2})-(\d{2})/, '$2/$3/$1');
        if (record.data_lanc) record.data_lanc = record.data_lanc.replace(/(\d{4})-(\d{2})-(\d{2})/, '$2/$3/$1');
        worksheet.addRow(record);
        });

        return workbook;
    } catch (error) {
        throw new Error('Erro ao gerar planilha XLSX: ' + error.message);
    }
    }

    /**
     * =============================================================================
     * SSP
     * =============================================================================
     */
    async function insert_setup_polimento(HRpedido, login, cc, maquina, item, operacao, lote, horario, status, calibrador, HRfinalizado, obs) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        INSERT INTO gdm_setup_polimento (HRpedido, login, cc, maquina, item, operacao, lote, horario, status, calibrador, HRfinalizado, obs) 
        VALUES (${HRpedido}, ${login}, ${cc}, ${maquina}, ${item}, ${operacao}, ${lote}, ${horario}, ${status}, ${calibrador}, ${HRfinalizado}, ${obs})
        `;
        return result;
    } catch (error) { throw error; }
    }
    async function select_setup_polimento() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM gdm_setup_polimento`;
        return result.recordset;
    } catch (error) { throw error; }
    }
    async function update_setup_polimento(id, novoStatus) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        UPDATE gdm_setup_polimento SET status = ${novoStatus} WHERE Id = ${id}
        `;
        return result;
    } catch (error) { throw error; }
    }
    async function excluir_setup_polimento(id) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        DELETE FROM gdm_setup_polimento WHERE id = ${id}
        `;
        return result;
    } catch (error) { throw error; }
    }

/**
 * =============================================================================
 * SSV
 * =============================================================================
 */
async function insert_vagao(
HRpedido, login, Ctrab, op, qtd_op, material, qtd_mat, date,
status, status_EWM, prior, HRfinalizado, motivosSSV, obs
) {
try {
    const pool = await getConnection();
    const request = pool.request();

    const result = await request.query`
    DECLARE @now VARCHAR(19) =
        RIGHT('0'+CAST(DAY(GETDATE()) AS VARCHAR(2)),2)+'/' +
        RIGHT('0'+CAST(MONTH(GETDATE()) AS VARCHAR(2)),2)+'/' +
        CAST(YEAR(GETDATE()) AS VARCHAR(4))+' '+
        CONVERT(VARCHAR(8), GETDATE(), 108);

    BEGIN TRY
        BEGIN TRAN;

        -- 🔒 trava para evitar “raça”
        IF EXISTS (
        SELECT 1
        FROM dbo.gdm_ssv_QA WITH (UPDLOCK, HOLDLOCK)
        WHERE op = ${op}
            AND material = ${material}
            AND status = 'Esc'
            AND status_EWM = 'Aguardando'
            -- ✅ agora considera também o Motivo (normalizado)
            AND LTRIM(RTRIM(UPPER(motivosSSV))) = LTRIM(RTRIM(UPPER(${motivosSSV})))
        )
        BEGIN
        SELECT CAST(NULL AS INT) AS Id, CAST(1 AS BIT) AS Duplicate;
        ROLLBACK;
        RETURN;
        END

        -- ✅ Insere + snapshot no HIST
        INSERT INTO dbo.gdm_ssv_QA
        (HRpedido, login, Ctrab, op, qtd_op, material, qtd_mat, [date],
        [status], status_EWM, prior, HRfinalizado, motivosSSV, obs)
        OUTPUT
        CAST(INSERTED.Id AS VARCHAR(12)),
        @now,
        INSERTED.login, INSERTED.Ctrab, INSERTED.op, INSERTED.qtd_op,
        INSERTED.material, INSERTED.qtd_mat, INSERTED.[date],
        INSERTED.motivosSSV, INSERTED.[status], INSERTED.status_EWM,
        INSERTED.prior, INSERTED.obs
        INTO dbo.gdm_ssv_hist
        (Id, horario, login, Ctrab, op, qtd_op, material, qtd_mat, [date],
        motivosSSV, [status], status_EWM, prior, obs)
        VALUES
        (${HRpedido}, ${login}, ${Ctrab}, ${op}, ${qtd_op}, ${material}, ${qtd_mat}, ${date},
        ${status}, ${status_EWM}, ${prior}, ${HRfinalizado}, ${motivosSSV}, ${obs});

        SELECT CAST(SCOPE_IDENTITY() AS INT) AS Id, CAST(0 AS BIT) AS Duplicate;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
    `;

    const row = result.recordset?.[0] || {};
    return { id: row.Id || null, duplicate: !!row.Duplicate };
} catch (error) {
    throw error;
}
}

// db.js
async function get_hist_by_id(id) {
  try {
    const pool = await getConnection();
    const request = pool.request();
    const result = await request.query`
      SELECT
        Id,
        horario,
        TRY_CONVERT(datetime2(0), horario, 103) AS horario_dt,
        login,
        status,
        status_EWM,
        -- mensagem padrão se obs vier vazio
        CASE
          WHEN obs IS NULL OR LTRIM(RTRIM(obs)) = ''
            THEN CONCAT('Status: ', status, ' / ', status_EWM)
          ELSE obs
        END AS mensagem
      FROM dbo.gdm_ssv_hist
      WHERE Id = ${String(id)}
      ORDER BY TRY_CONVERT(datetime2(0), horario, 103) DESC, horario DESC;
    `;
    return result.recordset;
  } catch (e) { throw e; }
}

async function select_vagao() {
  try {
    const pool = await getConnection();
    const request = pool.request();
    const result = await request.query`
      SELECT * FROM gdm_ssv_QA ORDER BY Id DESC
    `;
    return result.recordset;
  } catch (error) { throw error; }
}

async function update_vagao(id, novoStatus, HRfinalizado) {
  try {
    const pool = await getConnection();
    const request = pool.request();

    await request.query`
      UPDATE gdm_ssv_QA
         SET status = ${novoStatus},
             HRfinalizado = COALESCE(${HRfinalizado}, HRfinalizado)
       WHERE Id = ${id};
    `;

    await apply_ssv_side_effects(id);
    await insert_vagao_hist(id);

    return { ok: true };
  } catch (error) { throw error; }
}
 
async function update_vagao_ewm(id, status_EWM) {
  try {
    const pool = await getConnection();
    const request = pool.request();

    await request.query`
      UPDATE gdm_ssv_QA
         SET status_EWM = ${status_EWM}
       WHERE Id = ${id};
    `;

    await apply_ssv_side_effects(id);
    await insert_vagao_hist(id);

    return { ok: true };
  } catch (error) { throw error; }
}

// chame getConnection() como você já usa hoje
async function apply_ssv_side_effects(id) {
  try {
    const pool = await getConnection();
    const request = pool.request();

    const result = await request.query`
      DECLARE @id INT = ${id};

      -- timestamp dd/MM/yyyy HH:mm:ss
      DECLARE @now VARCHAR(19) =
        RIGHT('0'+CAST(DAY(GETDATE()) AS VARCHAR(2)),2)+'/'+
        RIGHT('0'+CAST(MONTH(GETDATE()) AS VARCHAR(2)),2)+'/'+
        CAST(YEAR(GETDATE()) AS VARCHAR(4))+' '+
        CONVERT(VARCHAR(8), GETDATE(), 108);

      DECLARE @st  VARCHAR(50);
      DECLARE @ewm VARCHAR(150);

      SELECT
        @st  = UPPER(LTRIM(RTRIM(ISNULL(status,'')))),
        @ewm = UPPER(LTRIM(RTRIM(ISNULL(status_EWM,''))))
      FROM gdm_ssv_QA
      WHERE Id = @id;

      -- Carimba todos os horarioN que se aplicarem (somente se vazios)
      UPDATE gdm_ssv_QA
      SET
        -- ESC / Coletado -> horario0
        horario0 = CASE WHEN @st='ESC'        AND @ewm='COLETADO'   AND (horario0 IS NULL OR LTRIM(RTRIM(horario0))='') THEN @now ELSE horario0 END,
        -- Montagem / Coletado -> horario1
        horario1 = CASE WHEN @st='MONTAGEM'   AND @ewm='COLETADO'   AND (horario1 IS NULL OR LTRIM(RTRIM(horario1))='') THEN @now ELSE horario1 END,
        -- GER / Aguardando -> horario2
        horario2 = CASE WHEN @st='GER'        AND @ewm='AGUARDANDO' AND (horario2 IS NULL OR LTRIM(RTRIM(horario2))='') THEN @now ELSE horario2 END,
        -- GER / Coletado -> horario3
        horario3 = CASE WHEN @st='GER'        AND @ewm='COLETADO'   AND (horario3 IS NULL OR LTRIM(RTRIM(horario3))='') THEN @now ELSE horario3 END,
        -- Rota / Coletado -> horario4
        horario4 = CASE WHEN @st='ROTA'       AND @ewm='COLETADO'   AND (horario4 IS NULL OR LTRIM(RTRIM(horario4))='') THEN @now ELSE horario4 END,
        -- ESC / Divergente -> horario5
        horario5 = CASE WHEN @st='ESC'        AND @ewm='DIVERGENTE' AND (horario5 IS NULL OR LTRIM(RTRIM(horario5))='') THEN @now ELSE horario5 END,
        -- GER / Divergente -> horario6
        horario6 = CASE WHEN @st='GER'        AND @ewm='DIVERGENTE' AND (horario6 IS NULL OR LTRIM(RTRIM(horario6))='') THEN @now ELSE horario6 END,
        -- Montagem / Cancelado -> horario7
        horario7 = CASE WHEN @st='MONTAGEM'   AND @ewm='CANCELADO'  AND (horario7 IS NULL OR LTRIM(RTRIM(horario7))='') THEN @now ELSE horario7 END,
        -- ESC / Cancelado -> horario8
        horario8 = CASE WHEN @st='ESC'        AND @ewm='CANCELADO'  AND (horario8 IS NULL OR LTRIM(RTRIM(horario8))='') THEN @now ELSE horario8 END,
        -- GER / Cancelado -> horario9
        horario9 = CASE WHEN @st='GER'        AND @ewm='CANCELADO'  AND (horario9 IS NULL OR LTRIM(RTRIM(horario9))='') THEN @now ELSE horario9 END,

        -- HR Finalizado: se qualquer coluna indicar "FINALIZADO" e ainda não tiver carimbo
        HRfinalizado = CASE
          WHEN (@st='FINALIZADO' OR @ewm='FINALIZADO')
           AND (HRfinalizado IS NULL OR LTRIM(RTRIM(HRfinalizado))='')
          THEN @now ELSE HRfinalizado END
      WHERE Id = @id;

      SELECT @@ROWCOUNT AS rc;
    `;

    return result;
  } catch (error) { throw error; }
}

async function insert_vagao_hist(id) {
  try {
    const pool = await getConnection();
    const request = pool.request();
    const result = await request.query`
      DECLARE @now VARCHAR(19) =
        RIGHT('0'+CAST(DAY(GETDATE()) AS VARCHAR(2)),2)+'/'+
        RIGHT('0'+CAST(MONTH(GETDATE()) AS VARCHAR(2)),2)+'/'+
        CAST(YEAR(GETDATE()) AS VARCHAR(4))+' '+
        CONVERT(VARCHAR(8), GETDATE(), 108);

      INSERT INTO gdm_ssv_hist
        (Id, horario, login, Ctrab, op, qtd_op, material, qtd_mat, [date],
         motivosSSV, status, status_EWM, prior, obs)
      SELECT
        CAST(Id AS VARCHAR(12)),
        @now,
        login, Ctrab, op, qtd_op, material, qtd_mat, [date],
        motivosSSV, status, status_EWM, prior, obs
      FROM gdm_ssv_QA
      WHERE Id = ${id};
    `;
    return result;
  } catch (error) { throw error; }
}

    async function update_vagao_obs(id, obs) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        UPDATE gdm_ssv_QA SET obs = ${obs} WHERE Id = ${id}
        `;
        return result;
    } catch (error) { throw error; }
    }
    async function excluir_vagao(id) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
        DELETE FROM gdm_ssv_QA WHERE id = ${id}
        `;
        return result;
    } catch (error) { throw error; }
    }

    // Exporta gdm_ssv_QA para XLSX (mantido)
    async function gerarPlanilhaXLSX_SSV(start, end) {
        try {
            const pool = await getConnection();
            const request = pool.request();

            let result;
            if (start && end) {
            result = await request.query`
                SELECT
                    Id, HRpedido, login, Ctrab, op, qtd_op, material, qtd_mat, [date],
                    motivosSSV,
                    horario0, horario1, horario2, horario3, horario4,
                    horario5, horario6, horario7, horario8, horario9, horario10,
                    [status], status_EWM, prior, HRfinalizado, obs
                FROM gdm_ssv_QA
                WHERE
                    TRY_CONVERT(datetime, HRpedido, 103) IS NOT NULL
                    AND TRY_CONVERT(datetime, HRpedido, 103)
                        >= CAST(${start} AS DATE)
                    AND TRY_CONVERT(datetime, HRpedido, 103)
                        <  DATEADD(day, 1, CAST(${end} AS DATE))
                ORDER BY Id DESC
            `;

            } else if (start) {
                result = await request.query`
                    SELECT ...
                    FROM gdm_ssv_QA
                    WHERE TRY_CONVERT(datetime, HRpedido, 103) >= CAST(${start} AS DATE)
                    ORDER BY Id DESC
                `;
            } else if (end) {
                result = await request.query`
                    SELECT ...
                    FROM gdm_ssv_QA
                    WHERE TRY_CONVERT(datetime, HRpedido, 103) < DATEADD(day,1, CAST(${end} AS DATE))
                    ORDER BY Id DESC
                `;
            }
            else {
            result = await request.query`
                SELECT ... FROM gdm_ssv_QA
                ORDER BY Id DESC
            `;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('SSV');

            worksheet.columns = [
            { header: 'ID', key: 'Id', width: 8 },
            { header: 'HR Pedido', key: 'HRpedido', width: 20 },
            { header: 'Login', key: 'login', width: 22 },
            { header: 'CT', key: 'Ctrab', width: 10 },
            { header: 'OP', key: 'op', width: 14 },
            { header: 'Qtd OP', key: 'qtd_op', width: 12 },
            { header: 'Material', key: 'material', width: 14 },
            { header: 'Qtd Material', key: 'qtd_mat', width: 14 },
            { header: 'Data', key: 'date', width: 12 },
            { header: 'Motivo SSV', key: 'motivosSSV', width: 26 },
            { header: 'ESC / Coletado', key: 'horario0', width: 20 },
            { header: 'Montagem / Coletado', key: 'horario1', width: 22 },
            { header: 'GER / Aguardando', key: 'horario2', width: 20 },
            { header: 'GER / Coletado', key: 'horario3', width: 20 },
            { header: 'ROTA / Coletado', key: 'horario4', width: 20 },
            { header: 'ESC / Saldo Divergente', key: 'horario5', width: 26 },
            { header: 'GER / Saldo Divergente', key: 'horario6', width: 26 },
            { header: 'Montagem / Cancelado', key: 'horario7', width: 24 },
            { header: 'ESC / Cancelado', key: 'horario8', width: 20 },
            { header: 'GER / Cancelado', key: 'horario9', width: 20 },
            { header: '—', key: 'horario10', width: 5, hidden: true },
            { header: 'Status', key: 'status', width: 16 },
            { header: 'Status EWM', key: 'status_EWM', width: 20 },
            { header: 'Prior', key: 'prior', width: 8 },
            { header: 'HR Finalizado', key: 'HRfinalizado', width: 20 },
            { header: 'Obs', key: 'obs', width: 40 },
            ];

            const headerRow = worksheet.getRow(1);
            headerRow.eachCell((cell) => {
            cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: '616366' } };
            cell.font   = { bold: true, color: { argb: '00A9E0' }, size: 10 };
            cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            result.recordset.forEach((record) => worksheet.addRow(record));
            return workbook;
        } catch (error) {
            throw new Error('Erro ao gerar planilha XLSX (SSV): ' + error.message);
        }
    }

// ==================================================================================================
// SSV - Função para buscar dados do gráfico SSV por campo dinâmico
// ==================================================================================================   
async function graficoSSV(tipo, start, end) {
    const pool = await getConnection();
    const request = pool.request();

    let sql = '';

    switch (tipo) {
        case 'dia':
            sql = `
                SELECT
                    CAST(TRY_CONVERT(datetime, HRpedido, 103) AS DATE) AS label,
                    COUNT(*) AS total
                FROM gdm_ssv_QA
                WHERE TRY_CONVERT(datetime, HRpedido, 103) IS NOT NULL
                  AND TRY_CONVERT(datetime, HRpedido, 103) >= CAST(@start AS DATE)
                  AND TRY_CONVERT(datetime, HRpedido, 103) < DATEADD(day,1, CAST(@end AS DATE))
                GROUP BY CAST(TRY_CONVERT(datetime, HRpedido, 103) AS DATE)
                ORDER BY label
            `;
            break;

        case 'op':
            sql = `
                SELECT TOP 20
                    op AS label,
                    COUNT(*) AS total
                FROM gdm_ssv_QA
                WHERE TRY_CONVERT(datetime, HRpedido, 103) >= CAST(@start AS DATE)
                  AND TRY_CONVERT(datetime, HRpedido, 103) < DATEADD(day,1, CAST(@end AS DATE))
                GROUP BY op
                ORDER BY total DESC
            `;
            break;

        case 'material':
            sql = `
                SELECT TOP 20
                    material AS label,
                    COUNT(*) AS total
                FROM gdm_ssv_QA
                WHERE TRY_CONVERT(datetime, HRpedido, 103) >= CAST(@start AS DATE)
                  AND TRY_CONVERT(datetime, HRpedido, 103) < DATEADD(day,1, CAST(@end AS DATE))
                GROUP BY material
                ORDER BY total DESC
            `;
            break;

        case 'motivo':
            sql = `
                SELECT TOP 20
                    motivosSSV AS label,
                    COUNT(*) AS total
                FROM gdm_ssv_QA
                WHERE TRY_CONVERT(datetime, HRpedido, 103) >= CAST(@start AS DATE)
                  AND TRY_CONVERT(datetime, HRpedido, 103) < DATEADD(day,1, CAST(@end AS DATE))
                GROUP BY motivosSSV
                ORDER BY total DESC
            `;
            break;

        default:
            throw new Error('Tipo de gráfico inválido');
    }

    request.input('start', start);
    request.input('end', end);

    const result = await request.query(sql);
    return result.recordset;
}


















// ==================================================================================================
// CAL-Função para inserir novo calibrador
// ==================================================================================================
async function insertCal(centro, Codi, grupo,  tipo, Descricao, status, Controlado, localizacao, frequencia, ultiCalibr, numeCertif, Obs) {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`
            INSERT INTO gdm_cal (centro, Codi, grupo, tipo, Descricao, status, Controlado, localizacao, frequencia, ultiCalibr, numeCertif, Obs)
            VALUES (${centro}, ${Codi}, ${grupo}, ${tipo}, ${Descricao}, ${status}, ${Controlado}, ${localizacao}, ${frequencia}, ${ultiCalibr}, ${numeCertif}, ${Obs})
        `;
        return result;
    } catch (error) {
        throw error;
    }
}

// ==================================================================================================
// CAL - Função Buscar movimentações do calibrador (tabela ferramentaria_ferramentas)
// ==================================================================================================
async function get_movimentacoes_calibrador(codigo, grupo) {
    try {
        const pool = await getConnection();
        const request = pool.request();

        const codSemZeros = codigo.replace(/^0+/, '');

        const result = await request
            .input('grupo', sql.VarChar, grupo)
            .input('codigo1', sql.VarChar, codigo)
            .input('codigo2', sql.VarChar, codSemZeros)
            .query(`
                SELECT TOP 50
                    Id,
                    Cod,
                    Seq,
                    Tipo,
                    Afi,
                    Local,
                    Item,
                    Status,
                    CONVERT(VARCHAR, DTEntra, 120)   AS DTEntra,
                    CONVERT(VARCHAR, DTCria, 120)    AS DTCria,
                    CONVERT(VARCHAR, DTEntrega, 120) AS DTEntrega,
                    Obs
                FROM dbo.ferramentaria_ferramentas
                WHERE Tipo = @grupo
                  AND (Cod = @codigo1 OR Cod = @codigo2)
                ORDER BY DTCria DESC;
            `);

        return result.recordset;

    } catch (error) {
        console.error('Erro ao buscar movimentações:', error);
        throw error;
    }
}


/**
 * =============================================================================
 * BLOQUEAR FERRAMENTA - Atualiza campo Bloq = 1 em dbo.ferramentaria_ferramentas
 * =============================================================================
 */
async function alterarBloqueioFerramenta(id, grupo, novoStatus) {
    try {
        const pool = await getConnection();
        const request = pool.request();

        request.input('id', id);
        request.input('grupo', grupo);
        request.input('bloq', novoStatus);

        const result = await request.query(`
            UPDATE dbo.ferramentaria_ferramentas
            SET 
                Bloq = @bloq,
                Obs =
                    CASE 
                        WHEN @bloq = '1' THEN
                            CASE 
                                WHEN Obs IS NULL OR LTRIM(RTRIM(Obs)) = '' 
                                    THEN 'Separar calibrador para metrologia'
                                ELSE CONCAT(Obs, ' | Separar calibrador para metrologia')
                            END
                        ELSE
                            REPLACE(
                                COALESCE(Obs, ''),
                                ' | Separar calibrador para metrologia',
                                ''
                            )
                    END
            WHERE Id = @id
              AND Tipo = @grupo
        `);

        if (result.rowsAffected[0] === 0) {
            throw new Error(`Nenhuma ferramenta encontrada com Id ${id} | Grupo ${grupo}.`);
        }

        console.log(
            novoStatus === '1'
                ? `🔒 Ferramenta ID ${id} BLOQUEADA.`
                : `🔓 Ferramenta ID ${id} DESBLOQUEADA.`
        );

        return result;
    } catch (err) {
        throw new Error('Erro ao alterar bloqueio: ' + err.message);
    }
}

    // ==================================================================================================
    // CAL-Função Buscar calibrador pelo código
    // ==================================================================================================
async function getCalibradorPorCodigo(codi, grupo) {
    try {
        const pool = await getConnection();
        const request = pool.request();

        const result = await request.query`
            SELECT *
            FROM gdm_cal
            WHERE Codi = ${codi}
                AND grupo = ${grupo}
        `;

        return result.recordset[0];
    } catch (error) {
        throw error;
    }
}


    // ==================================================================================================
    // CAL-Função Buscar calibrador pelo código
    // ==================================================================================================
    async function updateCalibrador(id, { Descricao, frequencia, status, Obs, localizacao, ultiCalibr, numeCertif, versaoCertif }) {
        try {
            const pool = await getConnection();
            const request = pool.request();
            const result = await request.query`
                UPDATE gdm_cal
                SET 
                    Descricao   = ${Descricao || null},
                    frequencia  = ${frequencia || null},
                    status      = ${status || null},
                    Obs         = ${Obs || null},
                    localizacao = ${localizacao || null},
                    ultiCalibr  = ${ultiCalibr || null},
                    numeCertif  = ${numeCertif || null},
                    versaoCertif= ${versaoCertif || null}
                WHERE Id = ${id}
            `;
            return result;
        } catch (error) {
            throw error;
        }
    }

    // ==================================================================================================
    // CAL-Função para deletar calibrador
    // ==================================================================================================
async function deleteCal(id, grupo) {
    try {
        const pool = await getConnection();
        const request = pool.request();

        const result = await request.query`
            DELETE FROM gdm_cal
            WHERE Id = ${id}
                AND grupo = ${grupo}
        `;

        return result;
    } catch (error) {
        throw error;
    }
}

/**
 * =============================================================================
 * CAL - Exportar gdm_cal para XLSX (com filtros)
 * =============================================================================
 */
async function gerarPlanilhaXLSX_CALIB(filtros) {
    try {
        const pool = await getConnection();
        const request = pool.request();

        let where = 'WHERE 1=1';
        if (filtros.grupo)       where += ` AND grupo = '${filtros.grupo}'`;
        if (filtros.tipo)        where += ` AND tipo LIKE '%${filtros.tipo}%'`;
        if (filtros.codigo)      where += ` AND Codi LIKE '%${filtros.codigo}%'`;
        if (filtros.status)      where += ` AND status LIKE '%${filtros.status}%'`;
        if (filtros.descricao)   where += ` AND Descricao LIKE '%${filtros.descricao}%'`;
        if (filtros.localizacao) where += ` AND localizacao LIKE '%${filtros.localizacao}%'`;

        const query = `
        SELECT 
            Id, centro, tipo, Codi, DigCal, Descricao, status, Controlado,localizacao, frequencia, 
            CONVERT(varchar(10), DATEADD(day, TRY_CONVERT(int, frequencia), TRY_CONVERT(date, ultiCalibr, 23)), 103) AS ProximaCalibr,
            CONVERT(varchar(10), TRY_CONVERT(date, ultiCalibr, 23), 103) AS ultiCalibr,
            numeCertif, versaoCertif, Obs
        FROM dbo.gdm_cal
        ${where}
        ORDER BY Id DESC
        `;

        const result = await request.query(query);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Equipamentos');

        worksheet.columns = [
        { header: 'ID',                  key: 'Id',              width: 8  },
        { header: 'Centro',              key: 'centro',          width: 8  },
        { header: 'Tipo',                key: 'tipo',            width: 18 },
        { header: 'Código',              key: 'Codi',            width: 14 },
        { header: 'Dígito',              key: 'DigCal',          width: 10 },
        { header: 'Descrição',           key: 'Descricao',       width: 40 },
        { header: 'Status',              key: 'status',          width: 18 },
        { header: 'Controlado',          key: 'Controlado',      width: 12 },
        { header: 'Localização',         key: 'localizacao',     width: 20 },
        { header: 'Frequência (dias)',   key: 'frequencia',      width: 16 },
        { header: 'Próxima Calibração',  key: 'ProximaCalibr',   width: 20 }, // NOVO
        { header: 'Última Calibração',   key: 'ultiCalibr',      width: 20 },
        { header: 'Número Certificado',  key: 'numeCertif',      width: 20 },
        { header: 'Versão Certificado',  key: 'versaoCertif',    width: 18 },
        { header: 'Observações',         key: 'Obs',             width: 40 },
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '616366' } };
        cell.font = { bold: true, color: { argb: '00A9E0' }, size: 10 };
        cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        result.recordset.forEach((record) => worksheet.addRow(record));
        worksheet.eachRow({ includeEmpty: false }, (row) => { row.height = 18; });

        return workbook;

    } catch (error) {
        throw new Error('Erro ao gerar planilha XLSX (Equipamentos): ' + error.message);
    }
}










    /**
     * =============================================================================
     * EWM
     * =============================================================================
     */
    async function select_ZRPP008() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM gdm_tabela_zrpp008_data`;
        return result.recordset;
    } catch (error) {
        console.error('Erro ao buscar dados do SQL:', error);
        throw error;
    }
    }
    async function select_ZRPP013() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM gdm_tabela_zrpp013`;
        return result.recordset;
    } catch (error) {
        console.error('Erro ao buscar dados do SQL:', error);
        throw error;
    }
    }
    async function select_EWM1() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM gdm_tabela_zrpp`;
        return result.recordset;
    } catch (error) {
        console.error('Erro ao buscar dados do SQL:', error);
        throw error;
    }
    }
    /**
     * =============================================================================
     * TI - EQUIPAMENTOS
     * =============================================================================
     */
        // LISTAR TODOS OS EQUIPAMENTOS
        async function listarEquipamentos() {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT Id, Descricao, NumeroChamado, NumeroSerie, NotaFiscal,
                Responsavel, CentroCusto, Quantidade, FornecedorId,
                Observacao, Status, CaminhoImagem, DataCadastro
            FROM dbo.gdm_ti_cad_eqp
            ORDER BY DataCadastro DESC
        `);
        return result.recordset;
        }

        // INSERIR NOVO EQUIPAMENTO
        async function inserirEquipamento(data) {
        const pool = await getConnection();
        const req = pool.request();

        req.input('Descricao', sql.NVarChar(200), data.Descricao);
        req.input('NumeroChamado', sql.NVarChar(60), data.NumeroChamado);
        req.input('NumeroSerie', sql.NVarChar(100), data.NumeroSerie);
        req.input('NotaFiscal', sql.NVarChar(50), data.NotaFiscal);
        req.input('Responsavel', sql.NVarChar(120), data.Responsavel);
        req.input('CentroCusto', sql.NVarChar(60), data.CentroCusto);
        req.input('Quantidade', sql.Int, data.Quantidade || 1);
        req.input('FornecedorId', sql.Int, data.FornecedorId || null);
        req.input('Observacao', sql.NVarChar(300), data.Observacao);
        req.input('Status', sql.NVarChar(20), data.Status || 'EM_ESTOQUE');
        req.input('CaminhoImagem', sql.NVarChar(300), data.CaminhoImagem || null);

        await req.query(`
            INSERT INTO dbo.gdm_ti_cad_eqp
            (Descricao, NumeroChamado, NumeroSerie, NotaFiscal, Responsavel, CentroCusto,
            Quantidade, FornecedorId, Observacao, Status, CaminhoImagem)
            VALUES (@Descricao, @NumeroChamado, @NumeroSerie, @NotaFiscal, @Responsavel,
                    @CentroCusto, @Quantidade, @FornecedorId, @Observacao, @Status, @CaminhoImagem)
        `);
        }

        // ALTERAR STATUS / FORNECEDOR / OBS
        async function atualizarEquipamento(id, data) {
        const pool = await getConnection();
        const req = pool.request();
        req.input('Id', sql.Int, id);
        req.input('Status', sql.NVarChar(20), data.Status);
        req.input('FornecedorId', sql.Int, data.FornecedorId || null);
        req.input('Observacao', sql.NVarChar(300), data.Observacao || null);

        await req.query(`
            UPDATE dbo.gdm_ti_cad_eqp
            SET Status = @Status,
                FornecedorId = @FornecedorId,
                Observacao = @Observacao,
                DataAtualizacao = SYSUTCDATETIME()
            WHERE Id = @Id
        `);
        }

// ==================================================================================================
// 🚥 ROTINA DOS FACILITADORES - ALTERAR PARADAS
// ==================================================================================================
// =======================================================================
// DB – UPDATE DA PARADA
// =======================================================================
async function update_monitor_parada(centro_trabalho, inicio, status_parada, Obs, status) {
    try {
        const pool = await getConnection();
        const request = pool.request();

        const result = await request.query`
            UPDATE gdm_monitor_paradas
            SET
                inicio = COALESCE(${inicio}, inicio),
                status_parada = COALESCE(${status_parada}, status_parada),
                Obs = COALESCE(${Obs}, Obs),
                Status = COALESCE(${status}, Status)
            WHERE centro_trabalho = ${centro_trabalho}
        `;

        return result;
    } catch (error) {
        console.error("Erro ao atualizar parada:", error);
        throw error;
    }
}



// ==================================================================================================
// 🚥 ROTINA DOS FACILITADORES - SELECIONAR PARADAS
// ==================================================================================================
async function select_gdm_monitor_paradas() {
    try {
        const pool = await getConnection();
        const request = pool.request();
        const result = await request.query`SELECT * FROM gdm_monitor_paradas`;
        return result.recordset;
    } catch (error) {
        console.error('Erro ao buscar dados do SQL:', error);
        throw error;
    }
}
// ==================================================================================================
// OTINA DOS FACILITADORES - PRODUÇÃO CT
// ==================================================================================================   
async function select_producao_ct() {
    const pool = await getConnection();
    const request = pool.request();

    const result = await request.query(`
        SELECT 
            Centro_Trabalho,
            Performance_Linha,
            T1, T2, T3, T4,
            Total_T,
            OP_Em_Producao,
            Acabamento,
            Qualidade,
            Try_Out,
            Material,
            Descricao,
            Data_Ult_Apont,
            Hora_Ult_Apont,
            Dias_sem_Apont,
            Horas_sem_Apont,
            Prod_Meta,
            Prod_Acumulada,
            Prod_Perc,
            OP_Convertida_Pcs,
            OP_Convertida_Dia,
            OP_Liberada_Pcs,
            OP_Liberada_Dia,
            Nao_Entrou_EWM_Pcs,
            Nao_Entrou_EWM_Dia,
            OP_Preparacao_Dia,
            Vagao_Completo_Dia,
            Status,
            Status_Apontamento
        FROM ZRPP030_PRODUCAO_CT
    `);

    return result.recordset;
}



    /**
     * =============================================================================
     * EXPORTS (MÓDULOS)
     * =============================================================================
     */
    module.exports = {
    // Pool/helpers
    getConnection,

    // CMG
    insertCSVData,
    select_cargaMaq,

    // SSU (setupusi)
    selectCustomers,
    insertCustomer,
    updateStatus,
    excluirSetupUsiPorId,

    // CAD
    usernameExists,
    insert_CAD,
    select_CAD,
    getUserById,
    usernameExistsForOtherId,
    update_CAD,
    getUsernameById,

    // Máquinas / ETQ
    getMaquinasPorCentroCusto,
    getEtiquetas,
    insertEtq,
    buscarEtiquetaPorId,

    // FIP / Folha / Login / APF
    getItemByFipN,
    getFolhaProcessoItem,
    selectLogin,
    insertferr_apont,
    selectferr_apont,
    update_ferr_apont,
    gerarPlanilhaXLSX,

    // SSP
    excluir_setup_polimento,
    update_setup_polimento,
    select_setup_polimento,
    insert_setup_polimento,

    // SSV
    excluir_vagao,
    update_vagao,
    update_vagao_ewm,
    update_vagao_obs,
    select_vagao,
    insert_vagao,
    gerarPlanilhaXLSX_SSV,
    insert_vagao_hist,
    apply_ssv_side_effects,
    get_hist_by_id,

    graficoSSV,
    
    // CAL
    insertCal,
    getCalibradorPorCodigo,
    updateCalibrador,
    deleteCal,
    get_movimentacoes_calibrador,
    gerarPlanilhaXLSX_CALIB,
    alterarBloqueioFerramenta,    

    // EWM
    select_ZRPP008,
    select_ZRPP013,
    select_EWM1,

    //TI - EQUIPAMENTOS
    listarEquipamentos,
    inserirEquipamento,
    atualizarEquipamento,

    // FACILITADORES - PARADAS
    update_monitor_parada,
    select_gdm_monitor_paradas,
    select_producao_ct,
    };