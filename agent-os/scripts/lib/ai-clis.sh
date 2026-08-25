#!/usr/bin/env bash
# AI CLI detection and installation for agent-os
#
# Four supported harnesses, deliberately. Each is installed unpinned so a
# rebuild always lands on the newest release the running Node supports.

detect_ai_clis() {
    local installed=()

    command -v claude &> /dev/null && installed+=("claude")
    command -v codex &> /dev/null && installed+=("codex")
    command -v opencode &> /dev/null && installed+=("opencode")
    command -v commandcode &> /dev/null && installed+=("commandcode")

    echo "${installed[*]}"
}

install_claude_code() {
    if command -v claude &> /dev/null; then
        log_success "Claude Code already installed"
        return 0
    fi

    log_info "Installing Claude Code..."
    npm install -g @anthropic-ai/claude-code

    if is_interactive; then
        log_info "Authenticating Claude Code..."
        echo ""
        echo "Please complete the authentication in your browser."
        read -p "Press Enter when ready to continue..." -r
        claude auth login
    else
        log_info "Run 'claude' to authenticate when ready"
    fi
}

install_codex() {
    if command -v codex &> /dev/null; then
        log_success "Codex already installed"
        return 0
    fi

    log_info "Installing Codex..."
    npm install -g @openai/codex

    log_info "Authenticating Codex..."
    echo ""
    echo "Run 'codex login', or set OPENAI_API_KEY."
    echo "Get your key at: https://platform.openai.com/api-keys"
}

install_opencode() {
    if command -v opencode &> /dev/null; then
        log_success "OpenCode already installed"
        return 0
    fi

    log_info "Installing OpenCode..."
    npm install -g opencode-ai

    log_info "Run 'opencode' to complete setup and authentication when ready."
}

install_command_code() {
    if command -v commandcode &> /dev/null; then
        log_success "Command Code already installed"
        return 0
    fi

    log_info "Installing Command Code..."
    npm install -g command-code

    log_info "Run 'commandcode' to complete setup and authentication when ready."
}

prompt_ai_cli_install() {
    local installed
    installed=$(detect_ai_clis)

    if [[ -n "$installed" ]]; then
        log_success "Found AI CLI(s): $installed"
        return 0
    fi

    echo ""
    log_warn "No AI coding CLI detected"
    echo ""
    echo "AgentOS supports these AI coding assistants:"
    echo ""
    echo "  1) Claude Code (Anthropic) - Recommended"
    echo "  2) Codex (OpenAI)"
    echo "  3) OpenCode (multi-provider)"
    echo "  4) Command Code"
    echo "  5) Skip - I'll install one myself"
    echo ""

    if ! is_interactive; then
        log_info "Non-interactive mode: Installing Claude Code by default"
        install_claude_code
        return
    fi

    read -p "Which would you like to install? [1-5, default: 1] " -r choice
    echo ""

    case "${choice:-1}" in
        1) install_claude_code ;;
        2) install_codex ;;
        3) install_opencode ;;
        4) install_command_code ;;
        5)
            log_info "Skipping AI CLI installation"
            echo ""
            echo "Install one of these before using AgentOS:"
            echo "  Claude Code:  npm install -g @anthropic-ai/claude-code"
            echo "  Codex:        npm install -g @openai/codex"
            echo "  OpenCode:     npm install -g opencode-ai"
            echo "  Command Code: npm install -g command-code"
            echo ""
            ;;
        *) log_warn "Invalid choice, skipping" ;;
    esac
}
