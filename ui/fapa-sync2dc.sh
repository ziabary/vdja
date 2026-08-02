#!/bin/sh
#rsync -avzh db/ ubuntu@dc-afranet.targoman.ir:/data/vadja/fapa/db
rsync -avzh package.json tsconfig.json ubuntu@dc-afranet.targoman.ir:/data/vadja/fapa/
rsync -avzh src/ ubuntu@dc-afranet.targoman.ir:/data/vadja/fapa/src
rsync -avzh public/ ubuntu@dc-afranet.targoman.ir:/data/vadja/fapa/public
# rsync -avzh cli/ ubuntu@dc-afranet.targoman.ir:/data/vadja/fapa/cli
# rsync -avzh scripts/ ubuntu@dc-afranet.targoman.ir:/data/vadja/fapa/scripts