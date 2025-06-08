# Installation Instructions
1. Open the `arduino-shocker` directory with PlatformIO and upload the code.
2. Install cloudflared using **winget install --id Cloudflare.cloudflared** for Windows, or your package manager on Linux. More info [here](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
3. Install **Node.js and npm** using your package manager if on linux or from [nodejs.org](https://nodejs.org/en) if on windows.
4. Install servers using the **install-win** or **install-lin** script. This runs npm install for the servers.
5. Add desired backgroung .png files to /ciab-frontend/src/assets/background_art/. If the background_art file is missing, add it.
6. Start the servers using **start-win** or **install-lin** script.

# Other information

  ### Troubleshooting
  - Make sure the Arduino is connected BEFORE starting the servers. If it gets disconnected during a session, restart the servers.
  - If the site is not loading, try clearing your browser cache.
  - If you cannot upload Arduino code, check the board version in the `platformio.ini` file.
  - Chrome seems to be much more stable than firefox


  ### If using ZeroTier VPN, here are some helpfull commands
  ```
  sudo pacman -S zerotier-one
  sudo systemctl start --now zerotier-one.service
  sudo systemctl status zerotier-one.service
  sudo zerotier-cli join [NETWORK_ID]
  sudo zerotier-cli leave [NETWORK_ID]

  sudo zerotier-cli listnetworks
  sudo zerotier-cli listpeers
  ```

  #### How to setup the network:
  1. Go to: https://my.zerotier.com/
  2. You will need to create a new network where all the users will join.
  3. After each user runs zerotier-cli join [NETWORK_ID], you will need to authenticate using the webui
