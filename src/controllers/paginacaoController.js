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

//let json = require('./paginacao-result.json');

exports.consumo = () => {
  async function getConsumo() {
    const consumo = await consultarCNPJ.consumo(API_KEY)
    return consumo
  }
  let result = getConsumo()
  return result
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
    var inscricoes_estaduais = ""
    if (item.estabelecimento.inscricoes_estaduais !== null && item.estabelecimento.inscricoes_estaduais !== undefined) {
      if (item.estabelecimento.inscricoes_estaduais.length > 0) {
        inscricoes_estaduais = item.estabelecimento.inscricoes_estaduais[0]
      }
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
      inscricoes_estaduais: inscricoes_estaduais,
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

async function fetchCNPJS(pages, result, cnae) {
  if (pages.length == 0) return result;

  const { results, errors } = await PromisePool.for(pages)
  .withConcurrency(10)
  .onTaskFinished((page, pool) => {
    // var array = [0,25,50,75,100]
    // var cicle = Math.round(pool.processedPercentage())
    // if (array.includes(cicle)) {
    //   console.log(`Progress: ${cicle}%`)  
    //   console.log("page =" + page) 
    // }
    //console.log(cicle % array.length)
    
    console.log("porcentagem =" + pool.processedPercentage())
    console.log("page =" + page) 
  })
  .process(async page => {
    return await getPesquisa(cnae, page)
  })
  let newResults = result.concat(results)
  if (errors.length > 0) {
    const page_errors = errors.map(row => ( row.item ));
    return await fetchCNPJS(page_errors, newResults, cnae)
  } else {
    console.log(`terminou paginação ${cnae}`)
    return newResults
  }
}

async function fetchInfo(cnpjs, result) {
  if (cnpjs.length == 0) return result;

  const { results, errors } = await PromisePool.for(cnpjs)
  .withConcurrency(200)
  .onTaskFinished((cnpj, pool) => {
    // console.log(pool.processedPercentage())
    var array = [0,25,50,75,100]
    var cicle = Math.round(pool.processedPercentage());
    if (array.includes(cicle)) {
      console.log(`Progress: ${cicle}%`);
    }
  })
  .process(async cnpj => {
    return await getCNPJ(cnpj)
  })
  let newResults = result.concat(results)
  if (errors.length > 0) {
    const cnpjs_errors = errors.map(row => ( row.item ));
    return await fetchInfo(cnpjs_errors, newResults)
  } else {
    console.log(`terminou busca cnpjs`)
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

function writeFileQ(workbook, filename) {
    return new Promise((resolve, reject) => {
        // the interface wasn't clearly documented, but this reasonable guess worked...
        const wb_opts = {bookType: 'xlsx', type: 'binary'};
        XLSX.writeFileAsync(filename, workbook, wb_opts, (error, result) => {
          return (error)? reject(error) : resolve(`${filename} criado com sucesso`);
        })
    })
}

exports.consultaCNAE = (cnae) => {
  var firstPage = getPesquisa(cnae, 1)
  return firstPage
    .then(function(json) {
      return Array.from(Array(json.paginacao.paginas).keys())
    })
    .then(function(result) {
      return fetchCNPJS(result, [], cnae)
    })
    .then(function(results) {
      let parsed = results.flatMap(item =>  item.data).map( row => ({ cnpj: row, }))
      let cnpjs = parsed.map (({cnpj}) => (cnpj));
      return fetchInfo(cnpjs, [], 0)
    })
    .then(function(results) {
      let parsed = parseResult(results)
      let data = flat(parsed)
      
      const wb = XLSX.utils.book_new();                     // create workbook
      const ws = XLSX.utils.json_to_sheet(data);          // convert data to sheet
      XLSX.utils.book_append_sheet(wb, ws, 'data');
      
      const exportFileName = `workbook_${cnae}.xls`;
      return writeFileQ(wb, exportFileName)
    })
}