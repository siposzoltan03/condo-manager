# Alertmanager config

`alertmanager.yml` in this directory is **not committed** — it holds SMTP
credentials. Ansible renders it on the server from
`ansible/templates/alertmanager.yml.j2` using the `smtp_*` / `alert_*` values in
`ansible/secrets.yml`, then `docker compose` mounts it into the container.

This directory (with this README) is committed only so the mount path exists in
the repo. To (re)deploy:

```sh
cd ansible && ansible-playbook monitoring.yml -e @secrets.yml
```
