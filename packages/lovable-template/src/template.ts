import { Template } from "e2b";

export const template = Template()
  .fromImage("e2bdev/base")

  .setUser("root")

  /*
    .runCmd("curl -fsSL https://deb.nodesource.com/setup_24.x | bash -")
    .aptInstall(["nodejs"])
   * */

  /*
    install bun version 1.2.15
  .runCmd("curl -fsSL https://bun.sh/install | bash -s -- bun-v1.2.15")

   srouce bashrc
  .runCmd("source /home/user/.bashrc")
    */
  .runCmd("npm install -g bun@1.2.15")

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

# Start Vite dev server on port 5173
cd /home/user/project
bunx vite --host 0.0.0.0 --port 5173 &

# Start OpenVSCode Server on port 3000 (no auth for sandbox use)
/home/user/openvscode-server/bin/openvscode-server --host 0.0.0.0 --port 3000 --without-connection-token --default-folder /home/user/project &

# Wait for both background processes
wait
SCRIPT
chmod +x /home/user/start.sh`);
