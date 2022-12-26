const express = require('express');
const app = express();
const router = express.Router();
//Rotas
const index = require('./routes/index');
const consultaRoute = require('./routes/consultaRoute');
app.use('/', index);
app.use('/consulta', consultaRoute);
module.exports = app;