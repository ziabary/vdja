#!/bin/sh
rsync -avzh package.json tsconfig.json dev@dc-afranet.targoman.ir:/data/vadja/app/
rsync -avzh src/ dev@dc-afranet.targoman.ir:/data/vadja/app/src
rsync -avzh public/ dev@dc-afranet.targoman.ir:/data/vadja/app/public
#rsync -avzh db/ dev@dc-afranet.targoman.ir:/data/vadja/app/db
#rsync -avzh scripts/ dev@dc-afranet.targoman.ir:/data/vadja/app/scripts