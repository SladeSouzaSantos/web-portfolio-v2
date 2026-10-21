# Immutable, tested Vite distribution. The CI downloads dist/ built by the tests job.
# The Mac Mini currently serves the extracted dist/ through its existing Nginx proxy.
FROM nginx:stable-alpine
COPY .ci/nginx-container.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
