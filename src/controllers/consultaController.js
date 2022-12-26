const XLSX = require('xlsx')
const consultarCNPJ = require('consultar-cnpj')
const async = require('async')
const flatten = require('flat')
const token = "kC71wDAFjNImmEiOJzMr0nx6AOOQ46mjt73a41wyljAv";
const { PromisePool } = require('@supercharge/promise-pool')
const fs = require('fs');

exports.get = (req, res, next) => {
    let cnpj = req.params.cnpj;

    async function getCNPJ(cnpj) {
        const empresa = await consultarCNPJ(cnpj.toString(), token)
        return empresa
    }

    getCNPJ(cnpj)
    .then(function(response) {
        res.status(201).json(response);
    });
};
exports.put = (req, res, next) => {
    let id = req.params.id;
    res.status(201).send(`Requisição recebida com sucesso! ${id}`);
};
exports.delete = (req, res, next) => {
    let id = req.params.id;
    res.status(200).send(`Requisição recebida com sucesso! ${id}`);
};