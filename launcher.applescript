set scriptPath to "/Users/thezivieamora/Cowork/AIA Agency Dashboard/davao-amora-dashboard/start-dashboard.sh"
do shell script "nohup /bin/bash " & quoted form of scriptPath & " > /tmp/davao-launcher.log 2>&1 &"
