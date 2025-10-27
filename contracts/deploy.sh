#!/bin/bash

# =============================================================================
# Script de Deploy Automatizado para BBRLPlus
# =============================================================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
echo "========================================"
echo "       BBRLPlus Deploy Script"
echo "========================================"
echo ""

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    log_error "Arquivo .env não encontrado!"
    log_info "Copie .env.example para .env e configure suas variáveis"
    exit 1
fi

# Carregar variáveis de ambiente
source .env

# Verificar variáveis obrigatórias
if [ -z "$PRIVATE_KEY" ]; then
    log_error "PRIVATE_KEY não configurada no .env"
    exit 1
fi

# Configurações padrão
NETWORK=${1:-"local"}
VERIFY=${2:-"false"}

case $NETWORK in
    "local")
        RPC_URL=$LOCAL_RPC_URL
        log_info "Deploying para rede LOCAL (Anvil)"
        ;;
    "testnet")
        RPC_URL=$TESTNET_RPC_URL
        log_info "Deploying para TESTNET"
        ;;
    "mainnet")
        RPC_URL=$MAINNET_RPC_URL
        log_warning "Deploying para MAINNET - CONFIRMAÇÃO NECESSÁRIA"
        echo -n "Tem certeza que deseja fazer deploy na mainnet? (yes/no): "
        read confirmation
        if [ "$confirmation" != "yes" ]; then
            log_info "Deploy cancelado pelo usuário"
            exit 0
        fi
        ;;
    *)
        log_error "Rede inválida. Use: local, testnet, ou mainnet"
        exit 1
        ;;
esac

if [ -z "$RPC_URL" ]; then
    log_error "RPC_URL não configurada para a rede $NETWORK"
    exit 1
fi

log_info "RPC URL: $RPC_URL"

# Verificar se forge está instalado
if ! command -v forge &> /dev/null; then
    log_error "Foundry (forge) não está instalado"
    log_info "Instale com: curl -L https://foundry.paradigm.xyz | bash && foundryup"
    exit 1
fi

# Compilar contratos
log_info "Compilando contratos..."
if ! forge build; then
    log_error "Falha na compilação dos contratos"
    exit 1
fi
log_success "Contratos compilados com sucesso"

# Executar testes (apenas se não for mainnet)
if [ "$NETWORK" != "mainnet" ]; then
    log_info "Executando testes..."
    if ! forge test; then
        log_error "Testes falharam"
        exit 1
    fi
    log_success "Todos os testes passaram"
fi

# Preparar comando de deploy
DEPLOY_CMD="forge script script/DeployBBRLPlus.s.sol:DeployBBRLPlus --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast"

# Adicionar verificação se solicitada
if [ "$VERIFY" == "true" ]; then
    if [ "$NETWORK" == "testnet" ] && [ -n "$BSCSCAN_API_KEY" ]; then
        DEPLOY_CMD="$DEPLOY_CMD --verify --etherscan-api-key $BSCSCAN_API_KEY"
        log_info "Verificação automática habilitada"
    elif [ "$NETWORK" == "mainnet" ] && [ -n "$ETHERSCAN_API_KEY" ]; then
        DEPLOY_CMD="$DEPLOY_CMD --verify --etherscan-api-key $ETHERSCAN_API_KEY"
        log_info "Verificação automática habilitada"
    else
        log_warning "API key não encontrada para verificação automática"
    fi
fi

# Executar deploy
log_info "Iniciando deploy..."
echo "Comando: $DEPLOY_CMD"
echo ""

if ! eval $DEPLOY_CMD; then
    log_error "Deploy falhou"
    exit 1
fi

log_success "Deploy executado com sucesso!"

# Sugerir próximos passos
echo ""
echo "========================================"
echo "         PRÓXIMOS PASSOS"
echo "========================================"
echo ""
log_info "1. Salve o endereço do contrato BBRLPlus"
log_info "2. Atualize CONTRACT_ADDRESS em todos os scripts"
log_info "3. Execute setup inicial:"
echo "   forge script script/ExampleUsageBBRLPlus.s.sol:ExampleUsageBBRLPlus --sig 'setupExample()' --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast"
echo ""
log_info "4. Verifique o estado do contrato:"
echo "   forge script script/QueryBBRLPlus.s.sol:QueryBBRLPlus --sig 'getContractOverview()' --rpc-url $RPC_URL"
echo ""

if [ "$VERIFY" != "true" ] && [ "$NETWORK" != "local" ]; then
    log_info "5. Para verificar o contrato posteriormente, execute:"
    echo "   forge verify-contract <CONTRACT_ADDRESS> BBRLPlus --rpc-url $RPC_URL --etherscan-api-key <API_KEY>"
fi

log_success "Deploy script finalizado!"