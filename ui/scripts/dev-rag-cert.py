"""Create a private, ignored loopback development certificate once."""
import datetime
import ipaddress
import pathlib
import sys
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

root = pathlib.Path(sys.argv[1])
cert_path, key_path, ca_path = root / 'rag-dev-cert.pem', root / 'rag-dev-key.pem', root / 'rag-dev-ca.pem'
if cert_path.exists() and key_path.exists() and ca_path.exists():
    sys.exit(0)
ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ca_subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, u'Targoman local development CA')])
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, u'app.localhost')])
now = datetime.datetime.utcnow()
ca = (x509.CertificateBuilder().subject_name(ca_subject).issuer_name(ca_subject).public_key(ca_key.public_key())
      .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=1))
      .not_valid_after(now + datetime.timedelta(days=30))
      .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True).sign(ca_key, hashes.SHA256()))
cert = (x509.CertificateBuilder().subject_name(subject).issuer_name(ca_subject).public_key(key.public_key())
        .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=1))
        .not_valid_after(now + datetime.timedelta(days=30))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName([x509.DNSName(u'app.localhost'), x509.DNSName(u'auth.localhost'),
                                                     x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]), critical=False)
        .sign(ca_key, hashes.SHA256()))
key_path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
                                       serialization.NoEncryption()))
cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
ca_path.write_bytes(ca.public_bytes(serialization.Encoding.PEM))
key_path.chmod(0o600)
cert_path.chmod(0o600)
