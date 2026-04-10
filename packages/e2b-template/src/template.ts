import { Template } from "e2b";

export const template = Template()
  .fromImage("e2bdev/base")
  .setUser("root")
  .runCmd("npm install -g bun@1.2.15")
  .runCmd("npm install -g pm2")
  .runCmd(
    "OPENVSCODE_TAG=$(curl -s https://api.github.com/repos/gitpod-io/openvscode-server/releases/latest | grep tag_name | cut -d'\"'  -f4) && " +
      'curl -fsSL "https://github.com/gitpod-io/openvscode-server/releases/download/${OPENVSCODE_TAG}/${OPENVSCODE_TAG}-linux-x64.tar.gz" -o /tmp/openvscode.tar.gz && ' +
      "mkdir -p /home/user/openvscode-server && " +
      "tar -xzf /tmp/openvscode.tar.gz -C /home/user/openvscode-server --strip-components=1 && " +
      "rm /tmp/openvscode.tar.gz",
  )
  .copy("starter-project-lovable", "/home/user/project")
  .runCmd("chown -R user:user /home/user")
  .setUser("user")
  .runCmd("cd /home/user/project && bun install")
  .runCmd(`cat > /home/user/start.sh << 'SCRIPT'
#!/bin/bash
cd /home/user/project

# Clean up any existing vite-dev process to avoid duplicates on restart
pm2 delete vite-dev 2>/dev/null || true

# Start Vite via pm2
pm2 start "bunx vite --host 0.0.0.0 --port 5173" \
  --name "vite-dev" \
  --restart-delay 2000 \
  --max-restarts 20

# Start OpenVSCode Server
/home/user/openvscode-server/bin/openvscode-server \
  --host 0.0.0.0 \
  --port 3000 \
  --without-connection-token \
  --default-folder /home/user/project &

# Keep container alive
wait
SCRIPT
chmod +x /home/user/start.sh`);
