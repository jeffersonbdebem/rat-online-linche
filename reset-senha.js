import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { emailCorporativo } from "./auth-service.js";
const email=document.getElementById("emailReset");
const botao=document.getElementById("btnResetSenha");
const mensagem=document.getElementById("resetMensagem");
async function enviar(){
  mensagem.textContent="";
  mensagem.className="login-message";
  const e=email.value.trim().toLowerCase();
  if(!emailCorporativo(e)){mensagem.textContent="Informe um e-mail corporativo @lincheti.com.br.";mensagem.classList.add("error");return;}
  botao.disabled=true;botao.textContent="Enviando...";
  try{
    await sendPasswordResetEmail(auth,e);
    mensagem.textContent="Se este e-mail estiver cadastrado, o link de redefinição será enviado.";
    mensagem.classList.add("success");
  }catch(err){
    console.error(err);
    mensagem.textContent="Não foi possível processar a solicitação agora. Tente novamente.";
    mensagem.classList.add("error");
  }finally{
    botao.disabled=false;botao.textContent="Enviar link de redefinição";
  }
}
botao.addEventListener("click",enviar);
email.addEventListener("keydown",e=>{if(e.key==="Enter")enviar();});
