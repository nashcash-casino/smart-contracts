FROM node:8.11.1

# Create the db dir
RUN mkdir -p /root/ganache/db

# Install testprc
RUN npm install -g ganache-cli

# Expose RPC port
EXPOSE 7545

# Make start script executable
COPY . /
RUN chmod +x ./start.sh

CMD ["./start.sh"]
