const app = require('../src/app');
const port = normalizaPort(process.env.PORT || '3000');
const paginacaoController = require('../src/controllers/paginacaoController')
const { PromisePool } = require('@supercharge/promise-pool')



async function getAll() {
    const arrayCNAE = [
        6911701
    ]
    const { results, errors } = await PromisePool.for(arrayCNAE)
    .withConcurrency(1)
    .onTaskFinished((cnae, pool) => {
        console.log("porcentagem =" + pool.processedPercentage())
        console.log("cnae =" + cnae) 
    })
    .process(async cnae => {
        return await paginacaoController.consultaCNAE(cnae)
    })

    console.log("terminou todos")
    console.log(`falhou ${errors}`)
}

function normalizaPort(val) {
    const port = parseInt(val, 10);
    if (isNaN(port)) {
        return val;
    }
    if (port >= 0) {
        return port;
    }
    return false;
}

app.listen(port, function () {
    getAll()
    // paginacaoController
    // .consumo()
    // .then(function(result) {
    //     console.log(result)
    // })
})

