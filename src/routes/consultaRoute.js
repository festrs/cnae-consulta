const express = require('express');
const router = express.Router();
const controller = require('../controllers/consultaController')
const paginacaoController = require('../controllers/paginacaoController')
router.get('/:cnpj', controller.get);
router.get('/cnae/:cnae', paginacaoController.consultaCNAE)
router.put('/:id', controller.put);
router.delete('/:id', controller.delete);
module.exports = router;