const XLSX = require('xlsx')
const consultarCNPJ = require('consultar-cnpj')
const async = require('async')
const flatten = require('flat')
require('dotenv').config()

var API_KEY = "";
if(process.env.API_KEY != null){
  API_KEY = process.env.API_KEY;
}
const { PromisePool } = require('@supercharge/promise-pool')
const fs = require('fs');
const MAX_RETRIES = 5
const cnae = 6621501

//let json = require('./paginacao-result.json');

async function getConsumo() {
  const consumo = await consultarCNPJ.consumo(API_KEY)
  console.log(consumo)
}

async function getCNPJ(cnpj) {
  const empresa = await consultarCNPJ(cnpj.toString(), API_KEY)
  return empresa
}

async function getPesquisa(cnae, page) {
  const data = await consultarCNPJ.pesquisa(
      { situacao_cadastral: "Ativa", atividade_principal_id: cnae },
      API_KEY, 
      page
    );
  return data
}

function parseResult(result) {
  result.map(
    ({ socios, estabelecimento }) => (socios, estabelecimento)
  )

  return result.map(function(item) {
    const socios = item.socios.map(({nome}) => (nome));
    var qualificacao_do_responsavel = ""

    if (item.qualificacao_do_responsavel !== null && item.qualificacao_do_responsavel !== undefined) {
      qualificacao_do_responsavel = item.qualificacao_do_responsavel.descricao
    }

    var porte_descricao = ""
    if (item.porte !== null && item.porte !== undefined) {
      porte_descricao = item.porte.descricao
    }
    var natureza_juridica_descricao = ""
    if (item.natureza_juridica !== null && item.natureza_juridica !== undefined) {
      natureza_juridica_descricao = item.natureza_juridica.descricao
    }
    var cidade_nome = ""
    if (item.estabelecimento.cidade !== null && item.estabelecimento.cidade !== undefined) {
      cidade_nome = item.estabelecimento.cidade.nome
    }
    var estado_nome = ""
    if (item.estabelecimento.estado !== null && item.estabelecimento.estado !== undefined) {
      estado_nome = item.estabelecimento.estado.nome
    }

    var estabelecimento = {
      cnpj: item.estabelecimento.cnpj,
      tipo: item.estabelecimento.tipo,
      nome_fantasia: item.estabelecimento.nome_fantasia,
      atividade_principal: item.estabelecimento.atividade_principal.descricao,
      capital_social: item.capital_social,
      razao_social: item.razao_social,
      natureza_juridica: natureza_juridica_descricao,
      porte: porte_descricao,
      situacao_cadastral: item.estabelecimento.situacao_cadastral,
      qualificacao_do_responsavel: qualificacao_do_responsavel,
      data_inicio_atividade: item.estabelecimento.data_inicio_atividade,
      email: item.estabelecimento.email,
      tipo_logradouro: item.estabelecimento.tipo_logradouro,
      logradouro: item.estabelecimento.logradouro,
      complemento: item.estabelecimento.complemento,
      numero: item.estabelecimento.numero,
      bairro: item.estabelecimento.bairro,
      cep: item.estabelecimento.cep,
      cidade: cidade_nome,
      estado: estado_nome,
      telefone1: item.estabelecimento.ddd1 + item.estabelecimento.telefone1,
      telefone2: item.estabelecimento.ddd2 + item.estabelecimento.telefone2,
      fax: item.estabelecimento.ddd_fax + item.estabelecimento.fax,
      inscricoes_estaduais: item.estabelecimento.inscricoes_estaduais[0],
    } 

    return { estabelecimento, socios } 
  })
}

function flat(array) {
  var result = []

  for (var i = array.length - 1; i >= 0; i--) {
    var object = array[i]
    if (object !== undefined && object !== null) {
      var flated = flatten(object)
      result.push(flated)
    }
  }
  return result
}

async function fetchCNPJS(pages, result, attemptCount) {
  if (pages.length == 0) return result;
  if (attemptCount > MAX_RETRIES) {
    return result
  }
  attemptCount ++

  const { results, errors } = await PromisePool.for(pages)
  .withConcurrency(2)
  .onTaskFinished((page, pool) => {
    console.log("porcentagem =" + pool.processedPercentage())
    console.log("page =" + page) 
  })
  .process(async page => {
    return await getPesquisa(cnae, page)
  })
  let newResults = result.concat(results)
  if (errors.length > 0) {
    const page_errors = errors.map(row => ( row.item ));
    return await fetchCNPJS(page_errors, newResults, attemptCount)
  } else {
    return newResults
  }
}

async function fetchInfo(cnpjs, result, attemptCount) {
  if (cnpjs.length == 0) return result;
  if (attemptCount > MAX_RETRIES) {
    return result
  }
  attemptCount ++

  const { results, errors } = await PromisePool.for(cnpjs)
  .withConcurrency(30)
  .onTaskFinished((cnpj, pool) => {
    console.log(pool.processedPercentage())
  })
  .process(async cnpj => {
    return await getCNPJ(cnpj)
  })
  let newResults = result.concat(results)
  if (errors.length > 0) {
    const cnpjs_errors = errors.map(row => ( row.item ));
    return await fetchInfo(cnpjs_errors, newResults, attemptCount)
  } else {
    return newResults 
  }
}

function saveXLSX(data, name) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  
  const dirpath = 'cnae-' + cnae
  fs.mkdirSync(dirpath, { recursive: true })
  XLSX.utils.book_append_sheet(wb, ws, 'Responses');
  XLSX.writeFile(wb, dirpath + '/'+ name +'.xlsx');

  console.log("finished creating XLSX " + name)
}

exports.consultaCNAE = (req, res, next) => {
  let cnae = req.params.cnae;
  var firstPage = getPesquisa(cnae, 1)
  firstPage
  .then(function(json) {
    var allPages = Array.from(Array(json.paginacao.paginas).keys())
    
    fetchCNPJS(allPages, [], 0)
    .then(function(results) {
      let parsed = results.flatMap(item =>  item.data).map( row => ({ cnpj: row, }))
      let cnpjs = parsed.map (({cnpj}) => (cnpj));

      fetchInfo(cnpjs, [], 0)
      .then(function(infoResults) {
          let parsed = parseResult(infoResults)
          let data = flat(parsed)

          const wb = XLSX.utils.book_new();                     // create workbook
          const ws = XLSX.utils.json_to_sheet(data);            // convert data to sheet
          XLSX.utils.book_append_sheet(wb, ws, 'users_sheet');  // add sheet to workbook

          const filename = "users.xlsx";
          const wb_opts = {bookType: 'xlsx', type: 'binary'};   // workbook options
          XLSX.writeFile(wb, filename, wb_opts);                // write workbook file

          res.setHeader('Content-Type', 'application/vnd.openxmlformats');
          res.setHeader("Content-Disposition", "attachment; filename=Report-" + cnae + "-.xlsx");

          const stream = fs.createReadStream(filename);         // create read stream
          stream.pipe(res);
      });
    });
  });
};