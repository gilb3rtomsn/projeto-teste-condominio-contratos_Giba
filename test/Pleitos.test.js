const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}

describe("Pleitos", function () {
  before(async function () {
    [
      sindico,
      proprietario101,
      proprietario102,
      proprietario201,
      proprietario202,
      autorizado101,
      ...addrs
    ] = await ethers.getSigners();

    // Deploy do contrato de Condominio
    condominio = await deploy("Condominio");
    console.log("Condominio instalado em", condominio.address);

    // Deploy do contrato de Pleitos
    pleito = await deploy("Pleitos", condominio.address);
    console.log("Pleito instalado em", pleito.address, "\n");

    // Preparação do contrato de Condominio
    await condominio.connect(sindico).adicionarUnidade(101, proprietario101.address);
    await condominio.connect(sindico).adicionarUnidade(102, proprietario102.address);
    await condominio.connect(sindico).adicionarUnidade(201, proprietario201.address);
    await condominio.connect(sindico).adicionarUnidade(202, proprietario202.address);
    await condominio
      .connect(proprietario101)
      .autorizarEndereco(101, autorizado101.address);

    UMA_SEMANA = 60 * 60 * 24 * 7;
    duracaoPleito = (await time.latest()) + UMA_SEMANA;
  });

  describe("Deploy", function () {
    it("Deve estar configurado o endereço do smart contract Condominio", async function () {
      expect(await pleito.condominio()).to.equal(condominio.address);
    });
  });

  describe("Pleitos", function () {
    it("Não deve criar pleito sem título", async function () {
      await expect(
        pleito.connect(sindico).novoPleito("", duracaoPleito)
      ).to.be.revertedWith("Titulo invalido");
    });
    it("Não deve criar pleito se o timestamp for menor ou igual ao atual", async function () {
      await expect(
        pleito.connect(sindico).novoPleito("Novo Pleito", await time.latest())
      ).to.be.revertedWith("Data limite invalida");
    });
    it("Não deve criar pleito se não for sindico do contrato de Condominio", async function () {
      await expect(
        pleito.connect(proprietario101).novoPleito("Novo Pleito", duracaoPleito)
      ).to.be.revertedWith("Somente sindico");
    });
    it("Deve criar pleito se for sindico do contrato de Condominio", async function () {
      await pleito.connect(sindico).novoPleito("Novo Pleito", duracaoPleito);
      expect((await pleito.pleitos(0)).titulo).to.equal("Novo Pleito");
      expect((await pleito.pleitos(0)).dataLimite).to.equal(duracaoPleito);
    });
    it("Não deve votar se não for proprietário nem autorizado da unidade", async function () {
      await expect(
        pleito.connect(addrs[0]).vota(0, 101, true)
      ).to.be.revertedWith("Votante invalido");
    });
    it("Deve votar se for proprietário da unidade", async function () {
      await pleito.connect(proprietario102).vota(0, 102, true);
      expect((await pleito.pleitos(0)).votosSim).to.equal(1);
      expect((await pleito.pleitos(0)).votosNao).to.equal(0);
    });
    it("Proprietário não deve votar se houver autorizado", async function () {
      await expect(
        pleito.connect(proprietario101).vota(0, 101, true)
      ).to.be.revertedWith("Votante invalido");
    });
    it("Deve votar se for autorizado da unidade", async function () {
      await pleito.connect(autorizado101).vota(0, 101, false);
      expect((await pleito.pleitos(0)).votosSim).to.equal(1);
      expect((await pleito.pleitos(0)).votosNao).to.equal(1);
    });
    it("Proprietário não deve votar se ele já tiver votado", async function () {
      await expect(
        pleito.connect(proprietario102).vota(0, 102, true)
      ).to.be.revertedWith("Unidade ja votou");
    });
    it("Proprietário não deve votar se autorizado já tiver votado, mesmo se tiver o desautorizado", async function () {
      await condominio.connect(proprietario101).desautorizarEndereco(101);
      await expect(
        pleito.connect(proprietario101).vota(0, 101, true)
      ).to.be.revertedWith("Unidade ja votou");
    });
    it("Não deve retornar resultado antes do encerramento do pleito", async function () {
      await expect(pleito.resultado(0)).to.be.revertedWith(
        "Pleito ainda nao encerrado"
      );
    });
    it("Deve retornar resultado após o encerramento do pleito", async function () {
      let tempoFuturo = (await time.latest()) + UMA_SEMANA + 1;
      await time.increaseTo(tempoFuturo);
      expect(await pleito.resultado(0)).to.equal("Empate");
    });
  });
});
