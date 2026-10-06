vault {
  address = "http://192.168.215.38:8200"
}

auto_auth {
  method "token_file" {
    config = {
      token_file_path = "/etc/vault.d/token"
    }
  }
}

env_template "GRAFANA_API_KEY" {
  contents             = "{{ with secret \"secret/data/grafana\" }}{{ .Data.data.api_key }}{{ end }}"
  error_on_missing_key = true
}

env_template "GRAFANA_METRICS_USER" {
  contents             = "{{ with secret \"secret/data/grafana\" }}{{ .Data.data.metrics_user }}{{ end }}"
  error_on_missing_key = true
}

env_template "GRAFANA_LOKI_USER" {
  contents             = "{{ with secret \"secret/data/grafana\" }}{{ .Data.data.loki_user }}{{ end }}"
  error_on_missing_key = true
}

env_template "OBJECT_STORAGE_KEY" {
  contents             = "{{ with secret \"secret/data/linode\" }}{{ .Data.data.object_storage_key }}{{ end }}"
  error_on_missing_key = true
}

env_template "OBJECT_STORAGE_SECRET" {
  contents             = "{{ with secret \"secret/data/linode\" }}{{ .Data.data.object_storage_secret }}{{ end }}"
  error_on_missing_key = true
}

env_template "BUCKET_NAME" {
  contents             = "{{ with secret \"secret/data/linode\" }}{{ .Data.data.bucket_name }}{{ end }}"
  error_on_missing_key = true
}

env_template "BUCKET_REGION" {
  contents             = "{{ with secret \"secret/data/linode\" }}{{ .Data.data.bucket_region }}{{ end }}"
  error_on_missing_key = true
}

exec {
  command                   = ["/usr/lib/alloy/alloy-wrapper"]
  restart_on_secret_changes = "always"
  restart_stop_signal       = "SIGTERM"
}
