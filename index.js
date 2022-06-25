const mysqldump = require('mysqldump')
const CronJob = require('cron').CronJob;
const fs = require('fs');
let v_jobs = [], v_timezone = "Asia/Jakarta";
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
                })
            }, null, true, v_timezone, null, false
        ));
    }
    print_log(`There is ${v_jobs.length} Crons Running`)
});
function print_log(...str_log) {
    const d = new Date();
    console.log(`[${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${d.getDate()}/${d.getMonth()}]`,(str_log.length>1)?str_log.join("\n"):str_log[0])
}
