const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then((f) => f.deployed());
}

describe("Condominio", function () {
  before(async function () {
    [
      sindicoDeployer,
      sindico,
      proprietario101,
      proprietario102,
      proprietario201,
      proprietario202,
      autorizado101,
      ...addrs
    ] = await ethers.getSigners();

    // Conta do síndico
    console.log("Conta do Síndico: ", sindico.address);

    // Deploy do contrato de Condominio
    condominio = await deploy("Condominio");
    console.log("Condominio instalado em", condominio.address, "\n");
  });

  describe("Deploy", function () {
    it("Deve ser síndico quem fez o deploy", async function () {
      expect(await condominio.sindico()).to.equal(sindicoDeployer.address);
    });
  });

  describe("Sindico", function () {
    it("Não deve poder alterar o síndico se não for o síndico", async function () {
      await expect(
        condominio.connect(addrs[0]).mudarSindico(addrs[1].address)
      ).to.be.revertedWith("Somente sindico");
    });

    it("Deve poder alterar o síndico se for o síndico", async function () {
      await expect(
        condominio.connect(sindicoDeployer).mudarSindico(sindico.address)
      ).to.emit(condominio, "NovoSindico");
    });
  });

  describe("Unidades", function () {
    it("Não deve poder incluir unidade se não for o síndico", async function () {
      await expect(
        condominio.connect(addrs[0]).adicionarUnidade(101, proprietario101.address)
      ).to.be.revertedWith("Somente sindico");
    });

    it("Não deve poder incluir unidade se endereço unidade for zero", async function () {
      await expect(
        condominio.connect(sindico).adicionarUnidade(0, proprietario101.address)
      ).to.be.revertedWith("Unidade invalida");
    });

    it("Não deve poder incluir unidade se conta do proprietario for 0x0", async function () {
      await expect(
        condominio
          .connect(sindico)
          .adicionarUnidade(101, ethers.constants.AddressZero)
      ).to.be.revertedWith("Proprietario invalido");
    });

    it("Deve poder incluir unidade se for o síndico", async function () {
      await expect(
        condominio.connect(sindico).adicionarUnidade(101, proprietario101.address)
      ).to.emit(condominio, "UnidadeAdicionada");

      expect((await condominio.unidades(101)).proprietario).to.equal(
        proprietario101.address
      );

      await expect(
        condominio.connect(sindico).adicionarUnidade(102, proprietario102.address)
      ).to.emit(condominio, "UnidadeAdicionada");

      expect((await condominio.unidades(102)).proprietario).to.equal(
        proprietario102.address
      );

      await expect(
        condominio.connect(sindico).adicionarUnidade(201, proprietario201.address)
      ).to.emit(condominio, "UnidadeAdicionada");

      expect((await condominio.unidades(201)).proprietario).to.equal(
        proprietario201.address
      );

      await expect(
        condominio.connect(sindico).adicionarUnidade(202, proprietario202.address)
      ).to.emit(condominio, "UnidadeAdicionada");

      expect((await condominio.unidades(202)).proprietario).to.equal(
        proprietario202.address
      );
    });

    it("Não deve poder incluir unidade se unidade já existe", async function () {
      await expect(
        condominio.connect(sindico).adicionarUnidade(101, proprietario101.address)
      ).to.be.revertedWith("Unidade existente");
    });

    it("Não deve excluir unidade se for não for o síndico", async function () {
      await expect(
        condominio.connect(addrs[0]).removerUnidade(101)
      ).to.be.revertedWith("Somente sindico");
    });

    it("Não deve excluir unidade se for proprietario", async function () {
      await expect(
        condominio.connect(proprietario101).removerUnidade(101)
      ).to.be.revertedWith("Somente sindico");
    });

    it("Deve excluir unidade se for o síndico", async function () {
      await condominio.connect(sindico).adicionarUnidade(999, addrs[0].address);

      await expect(condominio.connect(sindico).removerUnidade(999)).to.emit(
        condominio,
        "UnidadeRemovida"
      );

      expect((await condominio.unidades(999)).proprietario).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("Não deve atualizar proprietario se não for o síndico", async function () {
      await expect(
        condominio.connect(addrs[0]).atualizarProprietario(101, proprietario102.address)
      ).to.be.revertedWith("Somente sindico");
    });

    it("Deve atualizar proprietario se for o síndico", async function () {
      expect(
        await condominio
          .connect(sindico)
          .atualizarProprietario(101, proprietario102.address)
      ).to.emit(condominio, "ProprietarioAtualizado");

      expect((await condominio.unidades(101)).proprietario).be.equal(
        proprietario102.address
      );

      // Revertendo
      await condominio
        .connect(sindico)
        .atualizarProprietario(101, proprietario101.address);
    });
  });

  describe("Proprietarios", function () {
    it("Não deve autorizar endereço da unidade se não for proprietario", async function () {
      await expect(
        condominio.connect(addrs[0]).autorizarEndereco(101, addrs[0].address)
      ).to.be.revertedWith("Somente proprietario");
    });

    it("Não deve autorizar endereço da undiade se conta for 0x0", async function () {
      await expect(
        condominio
          .connect(proprietario101)
          .autorizarEndereco(101, ethers.constants.AddressZero)
      ).to.be.revertedWith("Endereco invalido");
    });

    it("Não deve autorizar endereço da unidade se for proprietario da unidade", async function () {
      await expect(
        condominio
          .connect(proprietario101)
          .autorizarEndereco(101, proprietario101.address)
      ).to.be.revertedWith("Proprietario nao pode se autorizar");
    });

    it("Deve autorizar endereço da unidade se for proprietario", async function () {
      await expect(
        condominio
          .connect(proprietario101)
          .autorizarEndereco(101, autorizado101.address)
      ).to.emit(condominio, "EnderecoAutorizado");

      expect((await condominio.unidades(101)).autorizado).to.equal(
        autorizado101.address
      );
    });

    it("Não deve autorizar endereço da unidade se já tiver sido autorizado", async function () {
      await expect(
        condominio
          .connect(proprietario101)
          .autorizarEndereco(101, autorizado101.address)
      ).to.be.revertedWith("Endereco ja autorizado");
    });

    it("Não deve desautorizar endereço da unidade se não for proprietario", async function () {
      await expect(
        condominio.connect(addrs[0]).desautorizarEndereco(101)
      ).to.be.revertedWith("Somente proprietario");
    });

    it("Deve desautorizar endereço da unidade se for proprietario", async function () {
      await expect(
        condominio.connect(proprietario101).desautorizarEndereco(101)
      ).to.emit(condominio, "EnderecoDesautorizado");

      expect((await condominio.unidades(101)).autorizado).to.equal(
        ethers.constants.AddressZero
      );
    });

    describe("Autorizados", function () {
      it("Não deve se desautorizar se não for autorizado", async function () {
        await expect(
          condominio.connect(proprietario101).desautorizarSe(101)
        ).to.be.revertedWith("Somente autorizado");
      });

      it("Autorizado deve poder se desautorizar", async function () {
        await condominio
          .connect(proprietario101)
          .autorizarEndereco(101, autorizado101.address);

        await expect(
          condominio.connect(autorizado101).desautorizarSe(101)
        ).to.emit(condominio, "EnderecoDesautorizouSe");

        expect((await condominio.unidades(101)).autorizado).to.equal(
          ethers.constants.AddressZero
        );
      });
    });

    describe("Adicionando e removendo address do mapping enderecos", function (){

      it("Deve adicionar nova unidade 999 para o endereço addrs[10]", async function (){
        await condominio.connect(sindico).adicionarUnidade(999, addrs[10].address)
      })

      it("Deve ser revertido 1000 pois o addrs[10] já tem unidade", async function (){
        await expect(condominio.connect(sindico).adicionarUnidade(1000, addrs[10].address)).to.be.revertedWith("Proprietario ja esta adicionado a outra unidade");
      })

      it("Sindico deve atualizar unidade 999 para o endereço addrs[11]", async function (){
        await condominio.connect(sindico).atualizarProprietario(999, addrs[11].address)
      })

      it("Addrs[10] deve estar sem unidade", async function (){        
        expect(await condominio.connect(sindico).enderecos(addrs[10].address)).to.equal(0)        
      })

      it("Addrs[11] deve estar com a unidade 999", async function (){        
        expect(await condominio.connect(sindico).enderecos(addrs[11].address)).to.equal(999)        
      })

      it("Sindico deve atualizar unidade 999 para o endereço addrs[10]", async function (){
          await condominio.connect(sindico).atualizarProprietario(999, addrs[10].address)
      })

      it("Addrs[10] deve estar com a unidade 999", async function (){        
        expect(await condominio.connect(sindico).enderecos(addrs[10].address)).to.equal(999)        
      })

      it("Sindico deve remover unidade 999", async function (){
        await condominio.connect(sindico).removerUnidade(999)
      })

      it("Addrs[10] deve estar sem unidade", async function (){        
        expect(await condominio.connect(sindico).enderecos(addrs[10].address)).to.equal(0)        
      })

    })

  });
});
