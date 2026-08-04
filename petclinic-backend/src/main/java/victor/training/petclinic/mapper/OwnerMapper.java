package victor.training.petclinic.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.springframework.data.domain.Page;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerFieldsDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;

import java.util.List;

@Mapper(componentModel = "spring", uses = PetMapper.class)
public interface OwnerMapper {

    OwnerDto toOwnerDto(Owner owner);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "pets", ignore = true)
    Owner toOwner(OwnerFieldsDto ownerDto);

    List<OwnerDto> toOwnerDtoCollection(List<Owner> ownerCollection);

    default OwnerPageDto toOwnerPageDto(Page<Owner> page) {
        OwnerPageDto dto = new OwnerPageDto();
        dto.setContent(toOwnerDtoCollection(page.getContent()));
        dto.setTotalElements(page.getTotalElements());
        dto.setTotalPages(page.getTotalPages());
        dto.setNumber(page.getNumber());
        dto.setSize(page.getSize());
        return dto;
    }

}
