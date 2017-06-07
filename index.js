const path = require('path');
const fs = require('fs');
const shell = require('shelljs');
const spawn = require('child_process').spawn;

exports.Converter = class{

constructor(){
    this.count = 0;
    this.defaultOptions = {
        'limits' : 5,
        'flag' : '-n'
    };
    this.totalFiles = 0;
}
/** 
* @param src : đường dẫn thư mục gốc cần convert
*/
//TODO : đọc và trả về mảng chứa toàn bộ files trong thư mục gốc
getFiles(src,done){
    let flacArray = [],
        mp3Array = [];
    fs.readdir(src,(err,files)=>{
        if(err) return done(err);
        let pending = files.length;
        if(!pending) return done(null,flacArray,mp3Array);
        files.forEach((file)=>{
            file = path.resolve(src,file);
            fs.stat(file,(err,stats)=>{
                if(stats && stats.isDirectory()){
                    this.getFiles(file,(err,res,res1)=>{
                        flacArray = flacArray.concat(res);
                        mp3Array = mp3Array.concat(res1);
                        if(!--pending) done(null,flacArray,mp3Array);
                    });
                }else{
                    if(this.checkFlac(file)){
                        file = file.replace(this.src_folder + '/','');
                        flacArray.push(file);
                        //change to Mp3 extension
                        mp3Array.push(this.changeToMp3(file));
                    } 
                    if(!--pending) done(null,flacArray,mp3Array);                        
                }
            });
        });
    });
} 

// file flac thì push vào mảng
checkFlac(file){
    return (path.extname(file) === '.flac');
}

/**
* @param files : mảng chứa files flac
*/
//TODO: trả về file chứa đường dẫn output
changeToMp3(file){
    return file.replace('.flac','.mp3');
}

/**
* @param inputFile : đường dẫn file flac cần convert
* @param outputArr : đường dẫn file mp3 output ra
*/
//TODO : Convert single file Flac to Mp3
flacToMp3(inputFile,outputFile,options,done) {
    let tempdir = outputFile.replace("/" + path.basename(outputFile),'');
    // shell dùng tao subfolder
    shell.mkdir('-p',tempdir);
    let converter = spawn('ffmpeg', [options.flag, '-i', inputFile, '-ab', '320k', '-map_metadata', '0', '-id3v2_version', '3', outputFile]);
    converter.on('close', (code) => {
        if (code === 0) done(null,path.basename(inputFile));
        else done(`File ${inputFile} already exist or caught error!!`,inputFile);
    });
}

/**
* @param inputArr : mảng chứa path files flac
* @param outputArr : mảng chứa path files mp3
* @param srcFolder : thư mục chứa file flac
* @param desFolder : thư mục chứa file đã convert sang mp3
*/
//TODO: Sử dụng vòng lặp để convert từng file trong mảng
Loop(inputArr,outputArr,options,done){
    let pending = inputArr.length;
    let donefiles = 0;
    if(!pending) return done(null,donefiles); 
    let tempFlac = inputArr.slice(0);
    let tempMp3 = outputArr.slice(0);
    tempFlac.forEach((file,index)=>{
        let inputFile = this.src_folder + '/' + file;
        let outputFile = this.des_folder + '/' + tempMp3[index];
        // Giới hạn convert tối đa số files dựa vào tham số option limits
        if(this.count < options.limits){
            this.count++;
            inputArr.shift();
            outputArr.shift();
            this.flacToMp3(inputFile,outputFile,options,(error,res)=>{
                if(error){
                    fs.writeFile(__dirname + "/log.txt",`${error} \n`,{'flag':'a'},(err)=>{
                        if(err) throw err;
                    });
                }else{
                    console.log(`--Completed--${res}`);
                }
                
                this.count--;
                donefiles++;
                if(!inputArr.length){
                    if(!--pending) return done(null,donefiles);         
                }else{
                    this.Loop(inputArr,outputArr,options,(err,res)=>{
                        donefiles += res;
                        if(!--pending) return done(null,donefiles); 
                    }); 
                }
            });
        }else{
            if(!--pending) return done(null,donefiles); 
        }
    });
}

//check options 
init(srcFolder,desFolder,options){
    this.src_folder = srcFolder;
    this.des_folder = desFolder; 
    if(!options) options = this.defaultOptions;
    if(!options.limits) options.limits = this.defaultOptions.limits;
    if(!options.flag) options.flag = this.defaultOptions.flag;
    return options;
}
/**
* @param srcFolder : thư mục chứa file flac
* @param desFolder : thư mục chứa file đã convert sang mp3
*/
//TODO : run application
runner(srcFolder,desFolder,options){
    console.log('Start Convert');
    console.time("Time during");
    options = this.init(srcFolder,desFolder,options);
    this.getFiles(srcFolder,(err,res,res1)=>{
        this.Loop(res,res1,options,(err,res)=>{
            console.log(`Convert completed : ${res} files`);
            console.timeEnd('Time during');
        });
    });
}
} 
