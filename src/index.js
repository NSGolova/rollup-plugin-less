import fs from 'fs-extra';
import { dirname } from 'path';
import less from 'less';
import { createFilter } from 'rollup-pluginutils';
import { insertStyle } from './style.js';
import mkdirp from 'mkdirp';

/**
 * 根据路径写入文件，文件夹不存在则创建
 * @param {String} path 路径
 * @param {String} contents 待写入文件内容
 * @param {Function} cb 回调函数
 */
const writeFile = (path, contents, cb) => {
    mkdirp(dirname(path), function (err) {
        if (err && typeof cb === 'function') return cb(err);

        fs.writeFile(path, contents, cb);
    });
}

let renderSync = (code, option) => {
    return less.render(code, option)
        .then(function(output){
            return output.css;
        }, function(error){
            throw error;
        })
};

let fileCount = 0;

export default function plugin (options = {}) {
    options.insert = options.insert || false;
    const filter = createFilter(options.include || [ '**/*.less', '**/*.css' ], options.exclude || 'node_modules/**');

    const injectFnName = '__$styleInject'
    return {
        name: 'less',
        intro() {
            return options.insert ? insertStyle.toString().replace(/insertStyle/, injectFnName) : '';
        },
        async transform(code, id) {
            if (!filter(id)) {
                return null;
            }
            fileCount++;

            try {
                options.option = options.option || {};
                options.option['filename'] = id;
                options.output = options.output || 'rollup.build.css';
                if (options.plugins) {
                  options.option['plugins'] = options.plugins
                }

                let css = await renderSync(code, options.option);

                if(options.output&&isFunc(options.output)){
                    css = await options.output(css, id);
                }

                if (options.output&&isString(options.output)) {
                    if(fileCount == 1){
                        //clean the output file
                        fs.removeSync(options.output);
                    }
                    writeFile(options.output, css);
                }

                let exportCode = '';

                if(options.insert!=false){
                    exportCode = `export default ${injectFnName}(${JSON.stringify(css.toString())});`;
                }else{
                    exportCode = `export default ${JSON.stringify(css.toString())};`;
                }
                return {
                    code: exportCode,
                    map: { mappings: '' }
                };
            } catch (error) {
                throw error;
            }
        }
    };
};

function isString (str) {
    if(typeof str == 'string'){
        return true;
    }else{
        return false;
    }
}

function isFunc (fn){
    if ( typeof fn == 'function' ){
        return true;
    }else{
        return false;
    }
}
