FROM node:8.11.1

# Create app directory and set as working directory
RUN mkdir -p /app
WORKDIR /app

# Add yarn.lock & package.json
ADD yarn.lock package.json ./
RUN yarn

# Copy app source
COPY . /app

RUN ["npm", "run", "compile"]
CMD ["npm", "run", "migrate", "--", "--reset"]
