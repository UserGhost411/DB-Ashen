const path = require('path');
const fs = require('fs');
const mysqldump = require('mysqldump')
const CronJob = require('cron').CronJob;
const {google} = require('googleapis');
let v_jobs = [], v_timezone = "Asia/Jakarta",gdrive=null,gdrive_folder="";
print_log("System Started")
fs.readFile('config.json', (err, data) => {
    let configdata;
    if (err) {
        if (err.errno == -4058) {
            console.log("Please rename new.config.json to config.json and Configurate Backup System There")
        } else {
            print_log(err)
        }
        process.exit(1);
    }
    try {
        configdata = JSON.parse(data);
    } catch(error) {
        print_log("Invalid Configuration File or Error JSON Formating, Please Recheck config.json",error)
        process.exit(1);
    }
    try {
        if (!fs.existsSync("./backup")) fs.mkdirSync("./backup");
    } catch (error) {
        print_log(error)
        process.exit(1);
    }
    v_timezone = configdata.timezone;
    if(configdata.gdrive.enabled){
        print_log("Google Drive Service Starting...")
        const auth = new google.auth.GoogleAuth({
            keyFile: configdata.gdrive.authkey,
            scopes: ["https://www.googleapis.com/auth/drive","https://www.googleapis.com/auth/drive.file"],
        });
        gdrive = google.drive({ version: "v3", auth });
        gdrive_folder = configdata.gdrive.folderid
        print_log((gdrive==null)?"Fail to Start Google Drive Service":"Google Drive Service Started and Online")
    }
    for (const config of configdata.backups) {
        if(!config.active) continue;
        v_jobs.push(new CronJob(config.cron,
            function () {
                let db_con = config.server
                let filepath = `./backup/${db_con.database}-${new Date().getTime()}.${((config.compress)?'sql.gz':'sql')}`;
                print_log(`Backup ${db_con.host}@${db_con.database} Starting`);
                mysqldump({
                    connection: db_con, dumpToFile: filepath, compressFile: config.compress,
                }).then(function () {
                    print_log(`Backup ${db_con.host}@${db_con.database} Saved at ${filepath}`);
                    if(gdrive!=null && config.upload && gdrive_folder!=""){
                        print_log(`Uploading ${path.basename(filepath)}`);
                        upload_file(filepath,[gdrive_folder]);
                    }
                })
            }, null, true, v_timezone, null, false
        ));
    }
    print_log(`There is ${v_jobs.length} Crons Running`)
    if(v_jobs.length<1){
        print_log("I guess im not needed!, terminating my own proccess")
        process.exit(0);
    }
});
function print_log(...str_log) {
    const d = new Date();
    console.log(`[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${d.getDate()}/${d.getMonth()}]`,(str_log.length>1)?str_log.join("\n"):str_log[0])
}
function toMime(filepath){
    let ext = path.extname(filepath).substring(1);
    let mimes = {"gz":"application/gzip","sql":"application/sql","txt":"text/plain","json":"application/json"}
    return (mimes[ext]!=null)?mimes[ext]:mimes['txt'];
}
function upload_file(filepath,drive_folder_id) { 
    if(gdrive==null) return;
    if(!fs.existsSync(filepath)) return;
    const meta = {"name": path.basename(filepath),"parents": drive_folder_id};
    const body = {mimeType:toMime(filepath),body: fs.createReadStream(filepath)};
    gdrive.files.create({
        requestBody: meta,
        media: body,
        supportsAllDrives: true,
        fields: "id,name"
    }, (err, file) => {
        if(err){
            print_log("Cant upload to GoogleDrive",err)
        }else if(file){
            print_log(`File ${path.basename(filepath)} Uploaded as ${file.data.id}`)
        }else{
            print_log("Error Happening Maybe")
        }
    });
}
