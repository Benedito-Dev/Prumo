// Serviço de senha — encapsula o bcrypt num só lugar.
import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export function gerarHash(senhaPura) {
  return bcrypt.hash(senhaPura, ROUNDS);
}

export function conferirSenha(senhaPura, hash) {
  return bcrypt.compare(senhaPura, hash);
}
