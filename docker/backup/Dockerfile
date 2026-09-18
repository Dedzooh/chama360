FROM postgres:15-alpine

RUN apk add --no-cache aws-cli openssl bash

COPY docker/backup/backup.sh /usr/local/bin/chama360-backup
RUN chmod 0755 /usr/local/bin/chama360-backup

ENTRYPOINT ["/usr/local/bin/chama360-backup"]
