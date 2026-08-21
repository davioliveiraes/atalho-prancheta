"""Testes das funções auxiliares — foco na extração de IP atrás de proxy."""

from django.test import RequestFactory, TestCase, override_settings

from shortener.utils import UNKNOWN_IP, get_client_ip


class GetClientIPTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _request(self, remote_addr="203.0.113.10", forwarded=None):
        extra = {"REMOTE_ADDR": remote_addr}
        if forwarded is not None:
            extra["HTTP_X_FORWARDED_FOR"] = forwarded
        return self.factory.get("/api/r/abc123/", **extra)

    @override_settings(TRUSTED_PROXY_COUNT=0)
    def test_sem_proxy_confiavel_usa_remote_addr(self):
        request = self._request(remote_addr="198.51.100.7")
        self.assertEqual(get_client_ip(request), "198.51.100.7")

    @override_settings(TRUSTED_PROXY_COUNT=0)
    def test_sem_proxy_confiavel_ignora_cabecalho_forjado(self):
        """Sem proxy na frente, X-Forwarded-For e texto livre do cliente."""
        request = self._request(remote_addr="198.51.100.7", forwarded="1.2.3.4")
        self.assertEqual(get_client_ip(request), "198.51.100.7")

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_um_proxy_le_o_cabecalho(self):
        request = self._request(remote_addr="10.0.0.1", forwarded="198.51.100.7")
        self.assertEqual(get_client_ip(request), "198.51.100.7")

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_um_proxy_descarta_prefixo_forjado(self):
        """O proxy acrescenta o IP real a direita; o que veio antes e do cliente."""
        request = self._request(remote_addr="10.0.0.1", forwarded="1.2.3.4, 198.51.100.7")
        self.assertEqual(get_client_ip(request), "198.51.100.7")

    @override_settings(TRUSTED_PROXY_COUNT=2)
    def test_dois_proxies_pulam_duas_entradas(self):
        request = self._request(remote_addr="10.0.0.2", forwarded="198.51.100.7, 10.0.0.1")
        self.assertEqual(get_client_ip(request), "198.51.100.7")

    @override_settings(TRUSTED_PROXY_COUNT=2)
    def test_cadeia_menor_que_o_esperado_cai_para_remote_addr(self):
        request = self._request(remote_addr="10.0.0.2", forwarded="1.2.3.4")
        self.assertEqual(get_client_ip(request), "10.0.0.2")

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_cabecalho_ausente_cai_para_remote_addr(self):
        request = self._request(remote_addr="10.0.0.1")
        self.assertEqual(get_client_ip(request), "10.0.0.1")

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_cabecalho_vazio_cai_para_remote_addr(self):
        request = self._request(remote_addr="10.0.0.1", forwarded="   ")
        self.assertEqual(get_client_ip(request), "10.0.0.1")

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_ip_invalido_cai_para_remote_addr(self):
        """Valor lixo nao pode chegar ao GenericIPAddressField."""
        request = self._request(remote_addr="10.0.0.1", forwarded="nao-e-um-ip")
        self.assertEqual(get_client_ip(request), "10.0.0.1")

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_espacos_em_volta_sao_removidos(self):
        request = self._request(remote_addr="10.0.0.1", forwarded="  198.51.100.7  ")
        self.assertEqual(get_client_ip(request), "198.51.100.7")

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_ipv4_com_porta(self):
        request = self._request(remote_addr="10.0.0.1", forwarded="198.51.100.7:54321")
        self.assertEqual(get_client_ip(request), "198.51.100.7")

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_ipv6_entre_colchetes_com_porta(self):
        request = self._request(remote_addr="10.0.0.1", forwarded="[2001:db8::1]:443")
        self.assertEqual(get_client_ip(request), "2001:db8::1")

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_ipv6_sem_colchetes(self):
        request = self._request(remote_addr="10.0.0.1", forwarded="2001:db8::1")
        self.assertEqual(get_client_ip(request), "2001:db8::1")

    @override_settings(TRUSTED_PROXY_COUNT=1)
    def test_ipv6_e_normalizado(self):
        """Formas diferentes do mesmo IPv6 devem contar como um visitante so."""
        expandido = self._request(
            remote_addr="10.0.0.1", forwarded="2001:0db8:0000:0000:0000:0000:0000:0001"
        )
        curto = self._request(remote_addr="10.0.0.1", forwarded="2001:db8::1")
        self.assertEqual(get_client_ip(expandido), get_client_ip(curto))

    @override_settings(TRUSTED_PROXY_COUNT=0)
    def test_sem_nenhum_ip_devolve_sentinela(self):
        """Click.ip_address e NOT NULL: sempre precisa sair um valor gravavel."""
        request = self.factory.get("/api/r/abc123/")
        request.META.pop("REMOTE_ADDR", None)
        self.assertEqual(get_client_ip(request), UNKNOWN_IP)
